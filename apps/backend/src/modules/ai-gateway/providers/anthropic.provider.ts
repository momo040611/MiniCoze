import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import type { ChatMessage, ToolCall, ToolDefinition } from '../../../shared/types/agent';
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderConfig,
  AiStreamChunk,
} from '../types';
import type { AiProviderInterface } from './ai-provider.interface';

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicStreamEvent {
  type?: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string | null;
  };
  content_block?: AnthropicContentBlock;
  message?: {
    usage?: { input_tokens?: number };
  };
  usage?: { input_tokens?: number; output_tokens?: number };
}

const DEFAULT_MAX_TOKENS = 4096;

// AnthropicProvider：Claude Messages API（/v1/messages）。
// 适配点（相对 OpenAI 协议）：
// - system 消息单独放 body.system，不进 messages
// - 工具结果：assistant 的 tool_calls → content.tool_use 块；
//   OpenAI 的 role:'tool' 消息 → user 角色 content.tool_result 块
// - 工具定义：parameters → input_schema
// - 流式：content_block_delta(delta.text / partial_json) + message_delta(stop)
@Injectable()
export class AnthropicProvider implements AiProviderInterface {
  constructor(private readonly config: AiProviderConfig) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const response = await this.callApi(request, false);
    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok || data.error) {
      this.handleApiError(data);
    }

    return this.parseResponse(data);
  }

  async *generateStream(
    request: AiGenerateRequest,
  ): AsyncGenerator<AiStreamChunk, void, unknown> {
    const response = await this.callApi(request, true);

    if (!response.ok) {
      this.handleApiError((await response.json()) as Record<string, unknown>);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new BusinessException(
        '无法读取流式响应',
        ErrorCode.AiModelError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    // tool_use 块的参数 JSON 是分片下发的，按 index 聚合。
    const toolCallState = new Map<
      number,
      { id: string; name: string; args: string }
    >();
    // usage 跨事件聚合：message_start 给 prompt，message_delta 给 completion。
    const usageState: { current: AiStreamChunk['usage'] } = { current: undefined };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const chunk = this.parseStreamLine(line, toolCallState, usageState);
          if (chunk) {
            yield chunk;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async callApi(request: AiGenerateRequest, stream: boolean) {
    const base = (this.config.baseUrl ?? '').replace(/\/+$/, '');
    const url = `${base}/v1/messages`;

    const { system, messages } = this.adaptMessages(request.messages);
    const tools = this.adaptTools(request.tools ?? []);

    const body: Record<string, unknown> = {
      model: request.model || this.config.defaultModel,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: request.temperature ?? 0.7,
      stream,
      messages,
    };
    if (system) {
      body.system = system;
    }
    if (tools) {
      body.tools = tools;
    }

    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': this.config.apiKey,
          ...(this.config.headers ?? {}),
        },
        body: JSON.stringify(body),
        signal: request.signal,
      });
    } catch (error) {
      if (request.signal?.aborted) {
        throw error;
      }
      throw new BusinessException(
        `模型请求网络错误: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.AiModelError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // OpenAI 风格消息 → Anthropic Messages 格式。
  private adaptMessages(messages: ChatMessage[]): {
    system: string | null;
    messages: AnthropicMessage[];
  } {
    const systemParts: string[] = [];
    const converted: AnthropicMessage[] = [];

    for (const message of messages) {
      switch (message.role) {
        case 'system':
          systemParts.push(message.content ?? '');
          break;
        case 'user':
          converted.push({ role: 'user', content: message.content ?? '' });
          break;
        case 'assistant': {
          const blocks: AnthropicContentBlock[] = [];
          if (message.content) {
            blocks.push({ type: 'text', text: message.content });
          }
          for (const toolCall of message.tool_calls ?? []) {
            let input: Record<string, unknown> = {};
            try {
              const parsed = JSON.parse(toolCall.function.arguments || '{}') as unknown;
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                input = parsed as Record<string, unknown>;
              }
            } catch {
              input = {};
            }
            blocks.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input,
            });
          }
          if (blocks.length > 0) {
            converted.push({
              role: 'assistant',
              content: blocks,
            });
          }
          break;
        }
        case 'tool': {
          // OpenAI 的 tool 消息 → user 角色的 tool_result 块。
          // tool_call_id 通过消息 name 字段无法保证，这里按顺序对应
          // （Anthropic 要求 tool_result 紧跟对应的 tool_use）。
          if (message.tool_call_id) {
            converted.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: message.tool_call_id,
                  content: message.content ?? '',
                },
              ],
            });
          } else {
            converted.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  content: message.content ?? '',
                },
              ],
            });
          }
          break;
        }
        default:
          break;
      }
    }

    return {
      system: systemParts.length > 0 ? systemParts.join('\n\n') : null,
      messages: converted,
    };
  }

  private adaptTools(tools: ToolDefinition[]): Array<Record<string, unknown>> | undefined {
    if (!tools?.length) {
      return undefined;
    }
    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description ?? '',
      input_schema: tool.function.parameters ?? { type: 'object', properties: {} },
    }));
  }

  private parseResponse(data: Record<string, unknown>): AiGenerateResponse {
    const contentBlocks = (data.content ?? []) as AnthropicContentBlock[];
    const text = contentBlocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');

    const toolCalls: ToolCall[] = contentBlocks
      .filter((block) => block.type === 'tool_use' && block.id && block.name)
      .map((block) => ({
        id: block.id!,
        type: 'function',
        function: {
          name: block.name!,
          arguments: JSON.stringify(block.input ?? {}),
        },
      }));

    const usage = data.usage as AnthropicStreamEvent['usage'] | undefined;

    return {
      content: text,
      model: (data.model as string) ?? '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: usage
        ? {
            promptTokens: usage.input_tokens ?? 0,
            completionTokens: usage.output_tokens ?? 0,
            totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          }
        : undefined,
    };
  }

  private parseStreamLine(
    line: string,
    toolCallState: Map<number, { id: string; name: string; args: string }>,
    usageState: { current: AiStreamChunk['usage'] },
  ): AiStreamChunk | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      return null;
    }

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') {
      return null;
    }

    let event: AnthropicStreamEvent;
    try {
      event = JSON.parse(payload) as AnthropicStreamEvent;
    } catch {
      return null;
    }

    switch (event.type) {
      case 'message_start':
        if (event.message?.usage) {
          usageState.current = {
            promptTokens: event.message.usage.input_tokens ?? 0,
            completionTokens: 0,
            totalTokens: event.message.usage.input_tokens ?? 0,
          };
        }
        return null;
      case 'content_block_start': {
        const block = event.content_block;
        if (block?.type === 'tool_use' && event.index !== undefined) {
          toolCallState.set(event.index, {
            id: block.id ?? '',
            name: block.name ?? '',
            args: '',
          });
        }
        return null;
      }
      case 'content_block_delta': {
        if (event.delta?.text) {
          return { content: event.delta.text, isFinished: false };
        }
        if (event.delta?.partial_json && event.index !== undefined) {
          const entry = toolCallState.get(event.index);
          if (entry) {
            entry.args += event.delta.partial_json;
          }
        }
        return null;
      }
      case 'message_delta': {
        if (event.usage) {
          const promptTokens = usageState.current?.promptTokens ?? 0;
          const completionTokens = event.usage.output_tokens ?? 0;
          usageState.current = {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          };
        }
        if (event.delta?.stop_reason) {
          const toolCalls = this.materializeToolCalls(toolCallState);
          return {
            content: '',
            isFinished: true,
            toolCalls,
            usage: usageState.current,
          };
        }
        return null;
      }
      case 'message_stop':
        return null;
      default:
        return null;
    }
  }

  private materializeToolCalls(
    toolCallState: Map<number, { id: string; name: string; args: string }>,
  ): ToolCall[] | undefined {
    const toolCalls = Array.from(toolCallState.entries())
      .sort(([a], [b]) => a - b)
      .filter(([, entry]) => entry.id && entry.name)
      .map(([, entry]) => ({
        id: entry.id,
        type: 'function' as const,
        function: {
          name: entry.name,
          arguments: entry.args || '{}',
        },
      }));
    return toolCalls.length > 0 ? toolCalls : undefined;
  }

  private handleApiError(data: Record<string, unknown>): never {
    const error = data.error as { message?: string } | undefined;
    const message = error?.message || JSON.stringify(data).slice(0, 300) || '模型调用失败';
    throw new BusinessException(
      `Anthropic 调用失败: ${message}`,
      ErrorCode.AiModelError,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
