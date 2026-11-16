import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import type { ChatMessage, ToolCall } from '../../../shared/types/agent';
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiProviderConfig,
  AiStreamChunk,
} from '../types';
import type { AiProviderInterface } from './ai-provider.interface';

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiStreamData {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

// GeminiProvider：Google Generative Language API（v1beta）。
// 适配点（相对 OpenAI 协议）：
// - system 消息放 body.systemInstruction
// - assistant 的 tool_calls → model 角色 parts.functionCall
// - role:'tool' 消息 → user 角色 parts.functionResponse
// - 工具定义 → tools[].functionDeclarations（parameters 即 JSON Schema）
// - 流式：:streamGenerateContent?alt=sse，逐个 JSON 事件
@Injectable()
export class GeminiProvider implements AiProviderInterface {
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
    // functionCall 不带 id：按出现顺序生成稳定 id，聚合同一轮的多个调用。
    let toolCallSeq = 0;
    let usage: AiStreamChunk['usage'];
    let finished = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const chunk = this.parseStreamLine(line, () => ++toolCallSeq, (u) => (usage = u));
          if (chunk) {
            if (chunk.isFinished) {
              finished = true;
            }
            yield chunk;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (finished) {
      yield { content: '', isFinished: true, usage };
    }
  }

  private async callApi(request: AiGenerateRequest, stream: boolean) {
    const base = (this.config.baseUrl ?? '').replace(/\/+$/, '');
    const model = encodeURIComponent(request.model || this.config.defaultModel);
    const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    const url = `${base}/v1beta/models/${model}:${method}`;

    const body = this.adaptRequest(request);

    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.config.apiKey,
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

  private adaptRequest(request: AiGenerateRequest): Record<string, unknown> {
    const systemParts: string[] = [];
    const contents: GeminiContent[] = [];

    for (const message of request.messages) {
      switch (message.role) {
        case 'system':
          systemParts.push(message.content ?? '');
          break;
        case 'user':
          contents.push({
            role: 'user',
            parts: [{ text: message.content ?? '' }],
          });
          break;
        case 'assistant': {
          const parts: GeminiPart[] = [];
          if (message.content) {
            parts.push({ text: message.content });
          }
          for (const toolCall of message.tool_calls ?? []) {
            let args: Record<string, unknown> = {};
            try {
              const parsed = JSON.parse(toolCall.function.arguments || '{}') as unknown;
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                args = parsed as Record<string, unknown>;
              }
            } catch {
              args = {};
            }
            parts.push({ functionCall: { name: toolCall.function.name, args } });
          }
          if (parts.length > 0) {
            contents.push({ role: 'model', parts });
          }
          break;
        }
        case 'tool': {
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: message.name || 'tool',
                  response: { result: message.content ?? '' },
                },
              },
            ],
          });
          break;
        }
        default:
          break;
      }
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        ...(request.maxTokens ? { maxOutputTokens: request.maxTokens } : {}),
      },
    };
    if (systemParts.length > 0) {
      body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };
    }

    const declarations = (request.tools ?? []).map((tool) => ({
      name: tool.function.name,
      description: tool.function.description ?? '',
      parameters: tool.function.parameters ?? { type: 'object', properties: {} },
    }));
    if (declarations.length > 0) {
      body.tools = [{ functionDeclarations: declarations }];
    }

    return body;
  }

  private parseResponse(data: Record<string, unknown>): AiGenerateResponse {
    const candidates = (data.candidates ?? []) as GeminiStreamData['candidates'];
    const parts = candidates?.[0]?.content?.parts ?? [];

    const text = parts
      .filter((part) => typeof part.text === 'string')
      .map((part) => part.text)
      .join('');

    const toolCalls = this.extractToolCalls(parts);

    const usage = data.usageMetadata as GeminiStreamData['usageMetadata'] | undefined;

    return {
      content: text,
      model: (data.modelVersion as string) ?? '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  private extractToolCalls(parts: GeminiPart[], seq: () => number = () => 0): ToolCall[] {
    const toolCalls = parts
      .filter((part) => part.functionCall?.name)
      .map((part) => ({
        id: `call_${seq()}`,
        type: 'function' as const,
        function: {
          name: part.functionCall!.name,
          arguments: JSON.stringify(part.functionCall!.args ?? {}),
        },
      }));
    return toolCalls;
  }

  private parseStreamLine(
    line: string,
    nextSeq: () => number,
    setUsage: (usage: AiStreamChunk['usage']) => void,
  ): AiStreamChunk | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      return null;
    }
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') {
      return null;
    }

    let data: GeminiStreamData;
    try {
      data = JSON.parse(payload) as GeminiStreamData;
    } catch {
      return null;
    }

    if (data.usageMetadata) {
      setUsage({
        promptTokens: data.usageMetadata.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata.totalTokenCount ?? 0,
      });
    }

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const text = parts
      .filter((part) => typeof part.text === 'string' && part.text.length > 0)
      .map((part) => part.text)
      .join('');
    const toolCalls = this.extractToolCalls(parts, nextSeq);

    const isFinished = Boolean(candidate?.finishReason);
    if (!text && !toolCalls && !isFinished) {
      return null;
    }

    return {
      content: text || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      isFinished,
    };
  }

  private handleApiError(data: Record<string, unknown>): never {
    const error = data.error as { message?: string } | undefined;
    const message = error?.message || JSON.stringify(data).slice(0, 300) || '模型调用失败';
    throw new BusinessException(
      `Gemini 调用失败: ${message}`,
      ErrorCode.AiModelError,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
