import { Injectable } from '@nestjs/common';
import { ModelProviderType, WorkspaceCredentialType } from '@prisma/client';
import type { ResolvedModel } from '../model-management/types/resolved-model.type';
import { DeepSeekProvider } from './providers/deepseek.provider';
import type { AiProviderInterface } from './providers/ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { AiProvider, AiProviderConfig } from './types';

@Injectable()
export class DynamicAiProviderFactory {
  create(resolvedModel: ResolvedModel): AiProviderInterface {
    // 动态 Provider 不读取环境变量，完全使用 ModelResolverService 解析出的配置。
    const config: AiProviderConfig = {
      provider: this.toAiProvider(resolvedModel.providerType),
      apiKey:
        resolvedModel.credential.type === WorkspaceCredentialType.BEARER_TOKEN
          ? resolvedModel.credential.secret
          : '',
      baseUrl: resolvedModel.baseUrl,
      defaultModel: resolvedModel.modelId,
      headers: this.buildAuthHeaders(resolvedModel),
    };

    if (resolvedModel.providerType === ModelProviderType.DEEPSEEK) {
      return new DeepSeekProvider(config);
    }

    // 第一阶段 OPENAI / DEEPSEEK / OPENAI_COMPATIBLE 都复用 OpenAI Compatible 协议。
    return new OpenAiProvider(config);
  }

  buildAuthHeaders(resolvedModel: ResolvedModel): Record<string, string> {
    // 不同凭证类型最终都会转成 HTTP Header，Provider 调用层只关心 headers。
    const credential = resolvedModel.credential;

    if (credential.type === WorkspaceCredentialType.API_KEY_HEADER) {
      return {
        [credential.headerName || 'Authorization']: credential.secret,
      };
    }

    if (credential.type === WorkspaceCredentialType.BASIC_AUTH) {
      const username = credential.username ?? '';
      const encoded = Buffer.from(`${username}:${credential.secret}`).toString(
        'base64',
      );

      return { Authorization: `Basic ${encoded}` };
    }

    return { Authorization: `Bearer ${credential.secret}` };
  }

  private toAiProvider(providerType: ModelProviderType): AiProvider {
    switch (providerType) {
      case ModelProviderType.DEEPSEEK:
        return AiProvider.DEEPSEEK;
      case ModelProviderType.OPENAI:
      case ModelProviderType.OPENAI_COMPATIBLE:
      default:
        return AiProvider.OPENAI;
    }
  }
}
