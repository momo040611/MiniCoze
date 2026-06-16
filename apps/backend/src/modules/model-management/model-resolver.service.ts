import { HttpStatus, Injectable } from '@nestjs/common';
import { ModelProviderType, WorkspaceCredentialType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { CredentialService } from '../credentials/credential.service';
import { WorkspaceModelService } from './workspace-model.service';
import { ResolveModelInput, ResolvedModel } from './types/resolved-model.type';

@Injectable()
export class ModelResolverService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly credentialService: CredentialService,
    private readonly workspaceModelService: WorkspaceModelService,
  ) {}

  async resolve(input: ResolveModelInput): Promise<ResolvedModel> {
    // 模型解析优先级：
    // 1. 本次运行显式 workspaceModelId
    // 2. Agent 持久化 workspaceModelId
    // 3. 工作区默认模型
    // 4. 旧 model 字符串 + 环境变量 Provider
    // 5. 环境变量默认模型
    const candidateId =
      input.requestedWorkspaceModelId ??
      input.agentWorkspaceModelId ??
      (input.workspaceId
        ? await this.workspaceModelService.getDefaultModelId(input.workspaceId)
        : null);

    if (candidateId && input.workspaceId) {
      try {
        return await this.resolveWorkspaceModel(input.workspaceId, candidateId);
      } catch (error) {
        if (!input.legacyModelName) {
          throw error;
        }

        // 数据库模型不可用时，若旧 model 字符串还存在，则降级到环境变量 Provider。
        // 这样旧前端和旧 Agent 不会因为设置模块配置错误直接不可运行。
        return this.resolveLegacyEnvModel(input.legacyModelName);
      }
    }

    return this.resolveLegacyEnvModel(input.legacyModelName);
  }

  resolveLegacyEnvModel(legacyModelName?: string | null): ResolvedModel {
    // legacy-env 只描述旧链路应使用的 provider/model。
    // 实际调用仍交给 AiGatewayService 的旧方法，保持环境变量初始化逻辑不变。
    const provider = this.configService.get<string>('ai.provider');

    if (provider === 'openai') {
      return {
        providerType: ModelProviderType.OPENAI,
        modelId:
          legacyModelName ||
          this.configService.get<string>('ai.openai.model') ||
          'gpt-4o-mini',
        baseUrl:
          this.configService.get<string>('ai.openai.baseUrl') ||
          'https://api.openai.com/v1',
        credential: {
          type: WorkspaceCredentialType.BEARER_TOKEN,
          secret: this.configService.get<string>('ai.openai.apiKey') || '',
        },
        source: 'legacy-env',
      };
    }

    return {
      providerType: ModelProviderType.DEEPSEEK,
      modelId:
        legacyModelName ||
        this.configService.get<string>('ai.deepseek.model') ||
        'deepseek-v4-flash',
      baseUrl:
        this.configService.get<string>('ai.deepseek.baseUrl') ||
        'https://api.deepseek.com',
      credential: {
        type: WorkspaceCredentialType.BEARER_TOKEN,
        secret: this.configService.get<string>('ai.deepseek.apiKey') || '',
      },
      source: 'legacy-env',
    };
  }

  private async resolveWorkspaceModel(
    workspaceId: string,
    workspaceModelId: string,
  ): Promise<ResolvedModel> {
    // 数据库模型解析会同时检查模型、Provider、Credential 三层状态。
    const model = await this.workspaceModelService.ensureSelectableModel(
      workspaceId,
      workspaceModelId,
    );
    const provider = await this.prisma.workspaceModelProvider.findFirst({
      where: { id: model.providerId, workspaceId },
    });

    if (!provider) {
      throw new BusinessException(
        '模型服务不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const credential = await this.credentialService.getRuntimeCredential(
      workspaceId,
      provider.credentialId,
    );

    return {
      // source=workspace 表示运行器可以使用动态 AI Gateway 入口。
      workspaceModelId: model.id,
      providerId: provider.id,
      providerType: provider.providerType,
      modelId: model.modelId,
      baseUrl: provider.baseUrl,
      credential: {
        type: credential.type,
        secret: credential.secret,
        headerName: this.readString(credential.config.headerName),
        username: this.readString(credential.config.username),
      },
      capabilities: this.toRecord(model.capabilities),
      source: 'workspace',
    };
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return undefined;
  }
}
