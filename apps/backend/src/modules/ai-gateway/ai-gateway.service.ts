import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import type {
  ChatMessage,
  ToolCall,
  ToolDefinition,
} from '../../shared/types/agent';
import type { ResolvedModel } from '../model-management/types/resolved-model.type';
import { DynamicAiProviderFactory } from './dynamic-ai-provider.factory';
import { AiProviderInterface } from './providers/ai-provider.interface';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { OpenAiProvider } from './providers/openai.provider';
import {
  AiGenerateRequest,
  AiGenerateResponse,
  AiProvider,
  AiProviderConfig,
  AiStreamChunk,
} from './types';

export interface ChatStreamInput {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface ChatStreamChunk {
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
}

@Injectable()
export class AiGatewayService {
  private readonly provider: AiProviderInterface;

  constructor(
    private readonly configService: ConfigService,
    private readonly dynamicAiProviderFactory: DynamicAiProviderFactory,
  ) {
    this.provider = this.createProvider();
  }

  generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    return this.provider.generate(request);
  }

  generateStream(
    request: AiGenerateRequest,
  ): AsyncGenerator<AiStreamChunk, void, unknown> {
    return this.provider.generateStream(request);
  }

  generateWithResolvedModel(
    resolvedModel: ResolvedModel,
    request: AiGenerateRequest,
  ): Promise<AiGenerateResponse> {
    // 新入口只服务数据库模型配置；旧 generate() 不受影响。
    const provider = this.dynamicAiProviderFactory.create(resolvedModel);
    return provider.generate({
      ...request,
      model: resolvedModel.modelId,
    });
  }

  generateStreamWithResolvedModel(
    resolvedModel: ResolvedModel,
    request: AiGenerateRequest,
  ): AsyncGenerator<AiStreamChunk, void, unknown> {
    const provider = this.dynamicAiProviderFactory.create(resolvedModel);
    return provider.generateStream({
      ...request,
      model: resolvedModel.modelId,
    });
  }

  async *chatStream(
    input: ChatStreamInput,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const stream: AsyncGenerator<AiStreamChunk, void, unknown> =
      this.generateStream(input);

    for await (const chunk of stream) {
      const content: string | undefined = chunk.content;
      const toolCalls = this.normalizeToolCalls(chunk.toolCalls);
      const isFinished: boolean = chunk.isFinished;
      const chatChunk: ChatStreamChunk = {};

      if (content !== undefined) {
        chatChunk.content = content;
      }

      if (toolCalls !== undefined) {
        chatChunk.toolCalls = toolCalls;
      }

      if (isFinished) {
        chatChunk.finishReason = 'stop';
      }

      yield chatChunk;
    }
  }

  async *chatStreamWithResolvedModel(
    resolvedModel: ResolvedModel,
    input: ChatStreamInput,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    // 动态流式入口复用旧 chatStream 的 chunk 归一化逻辑，保持上层事件格式一致。
    const stream: AsyncGenerator<AiStreamChunk, void, unknown> =
      this.generateStreamWithResolvedModel(resolvedModel, input);

    for await (const chunk of stream) {
      const content: string | undefined = chunk.content;
      const toolCalls = this.normalizeToolCalls(chunk.toolCalls);
      const isFinished: boolean = chunk.isFinished;
      const chatChunk: ChatStreamChunk = {};

      if (content !== undefined) {
        chatChunk.content = content;
      }

      if (toolCalls !== undefined) {
        chatChunk.toolCalls = toolCalls;
      }

      if (isFinished) {
        chatChunk.finishReason = 'stop';
      }

      yield chatChunk;
    }
  }

  private normalizeToolCalls(value: unknown): ToolCall[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const toolCalls = value.filter((item): item is ToolCall =>
      this.isToolCall(item),
    );

    return toolCalls.length ? toolCalls : undefined;
  }

  private isToolCall(value: unknown): value is ToolCall {
    if (!this.isRecord(value)) {
      return false;
    }

    const functionCall = value.function;

    return (
      typeof value.id === 'string' &&
      value.type === 'function' &&
      this.isRecord(functionCall) &&
      typeof functionCall.name === 'string' &&
      typeof functionCall.arguments === 'string'
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private createProvider(): AiProviderInterface {
    // 旧环境变量 Provider 仍在服务启动时创建，作为所有旧链路和兜底链路的基础。
    const provider = this.configService.get<AiProvider>('ai.provider');

    if (!provider) {
      throw new BusinessException(
        'AI_PROVIDER is not configured',
        ErrorCode.AiConfigError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    let config: AiProviderConfig;

    switch (provider) {
      case AiProvider.OPENAI:
        config = {
          provider: AiProvider.OPENAI,
          apiKey: this.configService.get<string>('ai.openai.apiKey')!,
          baseUrl: this.configService.get<string>('ai.openai.baseUrl')!,
          defaultModel:
            this.configService.get<string>('ai.openai.model') || 'gpt-4o-mini',
        };
        break;

      case AiProvider.DEEPSEEK:
        config = {
          provider: AiProvider.DEEPSEEK,
          apiKey: this.configService.get<string>('ai.deepseek.apiKey')!,
          baseUrl: this.configService.get<string>('ai.deepseek.baseUrl')!,
          defaultModel:
            this.configService.get<string>('ai.deepseek.model') ||
            'deepseek-v4-flash',
        };
        break;

      default:
        throw new BusinessException(
          `Unsupported AI provider: ${provider as string}`,
          ErrorCode.AiConfigError,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
    }

    // Validate the normalized provider config before instantiation.
    if (!config.apiKey || !config.baseUrl) {
      throw new BusinessException(
        `${provider} AI config is missing`,
        ErrorCode.AiConfigError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    switch (provider) {
      case AiProvider.OPENAI:
        return new OpenAiProvider(config);
      case AiProvider.DEEPSEEK:
        return new DeepSeekProvider(config);
      default:
        return new OpenAiProvider(config);
    }
  }
}
