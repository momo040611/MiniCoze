import { HttpStatus, Injectable } from '@nestjs/common';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ErrorCode } from '../../../common/constants/error-code';
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiStreamChunk,
  AiProviderConfig,
  OpenAiApiCompletionResponse,
  OpenAiApiErrorResponse,
  OpenAiApiStreamResponse,
} from '../types';
import type { AiProviderInterface } from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProviderInterface {
  constructor(private readonly config: AiProviderConfig) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const response = await this.callApi(request, false);
    const data = (await response.json()) as
      | OpenAiApiCompletionResponse
      | OpenAiApiErrorResponse;

    if (!response.ok) {
      this.handleApiError(data as OpenAiApiErrorResponse);
    }

    return this.parseResponse(data as OpenAiApiCompletionResponse);
  }

  async *generateStream(
    request: AiGenerateRequest,
  ): AsyncGenerator<AiStreamChunk, void, unknown> {
    const response = await this.callApi(request, true);

    if (!response.ok) {
      const data = (await response.json()) as OpenAiApiErrorResponse;
      this.handleApiError(data);
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
    const toolCallState = new Map<
      number | string,
      { id?: string; type?: 'function'; name?: string; args: string }
    >();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const chunk = this.parseStreamLine(line);
          if (!chunk) continue;
          const toolCalls = this.mergeToolCalls(toolCallState, chunk.toolCalls);
          yield toolCalls
            ? { ...chunk, toolCalls }
            : chunk.toolCalls
              ? { ...chunk, toolCalls: undefined }
              : chunk;
        }
      }

      if (buffer) {
        const chunk = this.parseStreamLine(buffer);
        if (chunk) {
          const toolCalls = this.mergeToolCalls(toolCallState, chunk.toolCalls);
          yield toolCalls
            ? { ...chunk, toolCalls }
            : chunk.toolCalls
              ? { ...chunk, toolCalls: undefined }
              : chunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async callApi(request: AiGenerateRequest, stream: boolean) {
    // 使用 URL API 拼接路径，兼容 baseUrl 带或不带尾斜杠的情况。
    const url = new URL(
      'chat/completions',
      `${this.config.baseUrl}/`,
    ).toString();

    const body = {
      model: request.model || this.config.defaultModel,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      tools: request.tools?.length ? request.tools : undefined,
      stream,
    };

    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new BusinessException(
        `模型请求网络错误: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.AiModelError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (this.config.headers) {
      return this.config.headers;
    }

    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  private parseResponse(data: OpenAiApiCompletionResponse): AiGenerateResponse {
    const choice = data.choices[0];
    return {
      content: choice?.message?.content || '',
      model: data.model || '',
      toolCalls: choice?.message?.tool_calls,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined,
    };
  }

  private parseStreamLine(line: string): AiStreamChunk | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'data: [DONE]') {
      if (trimmed === 'data: [DONE]') {
        return { content: '', isFinished: true };
      }
      return null;
    }

    if (!trimmed.startsWith('data:')) return null;

    try {
      const jsonStr = trimmed.slice(5).trim();
      const data = JSON.parse(jsonStr) as OpenAiApiStreamResponse;
      const delta = data.choices[0]?.delta;
      const finishReason = data.choices[0]?.finish_reason;

      return {
        content: delta?.content || '',
        toolCalls: delta?.tool_calls,
        isFinished: finishReason != null,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
      };
    } catch {
      return null;
    }
  }

  private mergeToolCalls(
    state: Map<
      number | string,
      { id?: string; type?: 'function'; name?: string; args: string }
    >,
    value: unknown,
  ): AiStreamChunk['toolCalls'] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    for (const item of value) {
      if (!this.isRecord(item)) continue;
      const key =
        typeof item.index === 'number'
          ? item.index
          : typeof item.id === 'string'
            ? item.id
            : undefined;
      if (key === undefined) continue;

      const entry = state.get(key) ?? { args: '' };
      if (typeof item.id === 'string') {
        entry.id = item.id;
      }
      if (item.type === 'function') {
        entry.type = 'function';
      }

      const functionCall: unknown = item.function;
      if (this.isRecord(functionCall)) {
        if (typeof functionCall.name === 'string') {
          entry.name = functionCall.name;
        }
        if (typeof functionCall.arguments === 'string') {
          entry.args += functionCall.arguments;
        }
      }

      state.set(key, entry);
    }

    const merged = Array.from(state.entries())
      .sort(([a], [b]) => {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
      })
      .map(([, entry]) => {
        if (!entry.id || !entry.name) return null;
        return {
          id: entry.id,
          type: entry.type ?? 'function',
          function: {
            name: entry.name,
            arguments: entry.args,
          },
        };
      })
      .filter(
        (item): item is NonNullable<AiStreamChunk['toolCalls']>[number] =>
          item !== null,
      );

    return merged.length ? merged : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private handleApiError(data: OpenAiApiErrorResponse): never {
    const message = data.error?.message || '模型调用失败';
    throw new BusinessException(
      message,
      ErrorCode.AiModelError,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
