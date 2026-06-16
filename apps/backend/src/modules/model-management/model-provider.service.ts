import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ModelConnectionStatus,
  Prisma,
  WorkspaceModelProvider,
} from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { CredentialService } from '../credentials/credential.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { CreateModelProviderDto } from './dto/create-model-provider.dto';
import { UpdateModelProviderDto } from './dto/update-model-provider.dto';
import { ModelProviderResponse } from './types/model-management-response.type';

@Injectable()
export class ModelProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly credentialService: CredentialService,
  ) {}

  async list(
    userId: string,
    workspaceId: string,
  ): Promise<ModelProviderResponse[]> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const providers = await this.prisma.workspaceModelProvider.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });

    return providers.map((provider) => this.toResponse(provider));
  }

  async create(
    userId: string,
    workspaceId: string,
    dto: CreateModelProviderDto,
  ): Promise<ModelProviderResponse> {
    // Provider 必须引用同一工作区的凭证，防止跨工作区复用密钥。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    await this.credentialService.ensureBelongsToWorkspace(
      workspaceId,
      dto.credentialId,
    );

    const provider = await this.prisma.workspaceModelProvider.create({
      data: {
        workspaceId,
        credentialId: dto.credentialId,
        createdBy: userId,
        name: dto.name,
        providerType: dto.providerType,
        baseUrl: this.normalizeBaseUrl(dto.baseUrl),
        enabled: dto.enabled ?? true,
      },
    });

    return this.toResponse(provider);
  }

  async get(
    userId: string,
    workspaceId: string,
    providerId: string,
  ): Promise<ModelProviderResponse> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);
    return this.toResponse(
      await this.findWorkspaceProviderOrThrow(workspaceId, providerId),
    );
  }

  async update(
    userId: string,
    workspaceId: string,
    providerId: string,
    dto: UpdateModelProviderDto,
  ): Promise<ModelProviderResponse> {
    // credentialId 发生变更时重新校验归属，避免 PATCH 绕过创建校验。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    await this.findWorkspaceProviderOrThrow(workspaceId, providerId);

    if (dto.credentialId) {
      await this.credentialService.ensureBelongsToWorkspace(
        workspaceId,
        dto.credentialId,
      );
    }

    const data: Prisma.WorkspaceModelProviderUpdateInput = {
      name: dto.name,
      providerType: dto.providerType,
      enabled: dto.enabled,
      credential: dto.credentialId
        ? { connect: { id: dto.credentialId } }
        : undefined,
      baseUrl: dto.baseUrl ? this.normalizeBaseUrl(dto.baseUrl) : undefined,
    };

    const provider = await this.prisma.workspaceModelProvider.update({
      where: { id: providerId },
      data,
    });

    return this.toResponse(provider);
  }

  async remove(
    userId: string,
    workspaceId: string,
    providerId: string,
  ): Promise<ModelProviderResponse> {
    // Provider 下还有模型时拒绝删除，避免级联删除破坏 Agent 模型引用。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    const provider = await this.findWorkspaceProviderOrThrow(
      workspaceId,
      providerId,
    );
    const modelCount = await this.prisma.workspaceModel.count({
      where: { workspaceId, providerId },
    });

    if (modelCount > 0) {
      throw new BusinessException(
        '模型服务下仍有模型，不能删除',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.workspaceModelProvider.delete({
      where: { id: providerId },
    });

    return this.toResponse(provider);
  }

  async updateConnectionStatus(
    workspaceId: string,
    providerId: string,
    status: ModelConnectionStatus,
    message: string,
  ): Promise<ModelProviderResponse> {
    await this.findWorkspaceProviderOrThrow(workspaceId, providerId);
    const provider = await this.prisma.workspaceModelProvider.update({
      where: { id: providerId },
      data: {
        connectionStatus: status,
        lastTestMessage: message,
        lastTestedAt: new Date(),
      },
    });

    return this.toResponse(provider);
  }

  async ensureRuntimeProvider(
    workspaceId: string,
    providerId: string,
  ): Promise<WorkspaceModelProvider> {
    // 运行时只允许使用启用状态的 Provider。
    const provider = await this.findWorkspaceProviderOrThrow(
      workspaceId,
      providerId,
    );

    if (!provider.enabled) {
      throw new BusinessException(
        '模型服务已停用',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    return provider;
  }

  async findWorkspaceProviderOrThrow(
    workspaceId: string,
    providerId: string,
  ): Promise<WorkspaceModelProvider> {
    const provider = await this.prisma.workspaceModelProvider.findFirst({
      where: { id: providerId, workspaceId },
    });

    if (!provider) {
      throw new BusinessException(
        '模型服务不存在或不属于当前工作区',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return provider;
  }

  normalizeBaseUrl(value: string): string {
    let parsed: URL;

    try {
      parsed = new URL(value);
    } catch {
      throw new BusinessException(
        'Base URL 格式无效',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Base URL 是后端保存的真实调用地址，只允许 http/https 主机地址。
    // 禁止账号密码、query、hash，避免把敏感信息混进 URL 或造成拼接歧义。
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BusinessException(
        'Base URL 只允许 http 或 https 协议',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new BusinessException(
        'Base URL 不能包含用户名、密码、query 或 hash',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!parsed.hostname) {
      throw new BusinessException(
        'Base URL 必须包含主机名或 IP',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    return parsed.toString().replace(/\/+$/, '');
  }

  private toResponse(provider: WorkspaceModelProvider): ModelProviderResponse {
    return {
      id: provider.id,
      workspaceId: provider.workspaceId,
      credentialId: provider.credentialId,
      createdBy: provider.createdBy,
      name: provider.name,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      enabled: provider.enabled,
      connectionStatus: provider.connectionStatus,
      lastTestMessage: provider.lastTestMessage,
      lastTestedAt: provider.lastTestedAt
        ? formatShanghaiDateTime(provider.lastTestedAt)
        : null,
      createdAt: formatShanghaiDateTime(provider.createdAt),
      updatedAt: formatShanghaiDateTime(provider.updatedAt),
    };
  }
}
