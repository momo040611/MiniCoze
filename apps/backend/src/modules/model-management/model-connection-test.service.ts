import { HttpStatus, Injectable } from '@nestjs/common';
import { ModelConnectionStatus } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { DynamicAiProviderFactory } from '../ai-gateway/dynamic-ai-provider.factory';
import { CredentialService } from '../credentials/credential.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { ModelProviderService } from './model-provider.service';
import { WorkspaceModelResponse } from './types/model-management-response.type';
import { ResolvedModel } from './types/resolved-model.type';
import { WorkspaceModelService } from './workspace-model.service';

interface OpenAiModelsResponse {
  data?: Array<{ id?: string }>;
}

@Injectable()
export class ModelConnectionTestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly credentialService: CredentialService,
    private readonly modelProviderService: ModelProviderService,
    private readonly workspaceModelService: WorkspaceModelService,
    private readonly dynamicAiProviderFactory: DynamicAiProviderFactory,
  ) {}

  async testProvider(userId: string, workspaceId: string, providerId: string) {
    // 连通性测试会写回 Provider 的状态，便于设置页展示最近一次测试结果。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);

    try {
      await this.fetchModels(workspaceId, providerId);
      return this.modelProviderService.updateConnectionStatus(
        workspaceId,
        providerId,
        ModelConnectionStatus.AVAILABLE,
        '连接成功',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.modelProviderService.updateConnectionStatus(
        workspaceId,
        providerId,
        ModelConnectionStatus.UNAVAILABLE,
        message,
      );
    }
  }

  async syncModels(
    userId: string,
    workspaceId: string,
    providerId: string,
  ): Promise<WorkspaceModelResponse[]> {
    // 同步只依赖 OpenAI Compatible 的 /models 响应；第一阶段不做厂商私有协议。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    const modelIds = await this.fetchModels(workspaceId, providerId);

    const syncedModels = await Promise.all(
      modelIds.map((modelId) =>
        this.prisma.workspaceModel.upsert({
          where: {
            providerId_modelId: {
              providerId,
              modelId,
            },
          },
          create: {
            workspaceId,
            providerId,
            modelId,
            displayName: modelId,
          },
          update: {
            displayName: modelId,
          },
        }),
      ),
    );

    const defaultModelId =
      await this.workspaceModelService.getDefaultModelId(workspaceId);

    return syncedModels.map((model) =>
      this.workspaceModelService.toResponse(model, defaultModelId),
    );
  }

  private async fetchModels(
    workspaceId: string,
    providerId: string,
  ): Promise<string[]> {
    // 使用 new URL 拼接 /models，避免 baseUrl 是否带尾斜杠造成路径错误。
    const provider = await this.modelProviderService.ensureRuntimeProvider(
      workspaceId,
      providerId,
    );
    const credential = await this.credentialService.getRuntimeCredential(
      workspaceId,
      provider.credentialId,
    );
    const resolvedModel: ResolvedModel = {
      providerId: provider.id,
      providerType: provider.providerType,
      modelId: '',
      baseUrl: provider.baseUrl,
      credential: {
        type: credential.type,
        secret: credential.secret,
        headerName: this.readString(credential.config.headerName),
        username: this.readString(credential.config.username),
      },
      source: 'workspace',
    };
    const url = new URL('models', `${provider.baseUrl}/`).toString();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...this.dynamicAiProviderFactory.buildAuthHeaders(resolvedModel),
      },
    });

    if (!response.ok) {
      throw new BusinessException(
        `模型服务连接失败: HTTP ${response.status}`,
        ErrorCode.AiModelError,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const data = (await response.json()) as OpenAiModelsResponse;
    const modelIds = (data.data ?? [])
      .map((item) => item.id)
      .filter((item): item is string => Boolean(item));

    if (!modelIds.length) {
      throw new BusinessException(
        '模型服务未返回可用模型列表',
        ErrorCode.AiModelError,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return modelIds;
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }
}
