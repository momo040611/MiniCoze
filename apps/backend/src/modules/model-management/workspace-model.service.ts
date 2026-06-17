import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, WorkspaceModel } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { CreateWorkspaceModelDto } from './dto/create-workspace-model.dto';
import { UpdateWorkspaceModelDto } from './dto/update-workspace-model.dto';
import {
  ModelReferenceResponse,
  WorkspaceModelResponse,
} from './types/model-management-response.type';

@Injectable()
export class WorkspaceModelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async list(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceModelResponse[]> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const [models, runtimeSetting] = await Promise.all([
      this.prisma.workspaceModel.findMany({
        where: { workspaceId },
        orderBy: [{ updatedAt: 'desc' }],
      }),
      this.prisma.workspaceRuntimeSetting.findUnique({
        where: { workspaceId },
      }),
    ]);

    return models.map((model) =>
      this.toResponse(model, runtimeSetting?.defaultModelId ?? null),
    );
  }

  async create(
    userId: string,
    workspaceId: string,
    dto: CreateWorkspaceModelDto,
  ): Promise<WorkspaceModelResponse> {
    // 模型必须挂在当前工作区的 Provider 下，不能跨工作区引用服务。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    await this.ensureProviderBelongsToWorkspace(workspaceId, dto.providerId);

    const model = await this.prisma.workspaceModel.create({
      data: {
        workspaceId,
        providerId: dto.providerId,
        modelId: dto.modelId,
        displayName: dto.displayName,
        enabled: dto.enabled ?? true,
        capabilities: this.toJsonInput(dto.capabilities),
        contextWindow: dto.contextWindow,
        maxOutputTokens: dto.maxOutputTokens,
      },
    });

    return this.toResponse(model, await this.getDefaultModelId(workspaceId));
  }

  async get(
    userId: string,
    workspaceId: string,
    modelId: string,
  ): Promise<WorkspaceModelResponse> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);
    const model = await this.findWorkspaceModelOrThrow(workspaceId, modelId);
    return this.toResponse(model, await this.getDefaultModelId(workspaceId));
  }

  async update(
    userId: string,
    workspaceId: string,
    modelId: string,
    dto: UpdateWorkspaceModelDto,
  ): Promise<WorkspaceModelResponse> {
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    await this.findWorkspaceModelOrThrow(workspaceId, modelId);

    if (dto.providerId) {
      await this.ensureProviderBelongsToWorkspace(workspaceId, dto.providerId);
    }

    const model = await this.prisma.workspaceModel.update({
      where: { id: modelId },
      data: {
        providerId: dto.providerId,
        modelId: dto.modelId,
        displayName: dto.displayName,
        enabled: dto.enabled,
        capabilities:
          dto.capabilities === undefined
            ? undefined
            : this.toJsonInput(dto.capabilities),
        contextWindow: dto.contextWindow,
        maxOutputTokens: dto.maxOutputTokens,
      },
    });

    return this.toResponse(model, await this.getDefaultModelId(workspaceId));
  }

  async remove(
    userId: string,
    workspaceId: string,
    modelId: string,
  ): Promise<WorkspaceModelResponse> {
    // 删除前先做引用检查，避免 Agent 或默认设置指向不存在的模型。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    const model = await this.findWorkspaceModelOrThrow(workspaceId, modelId);
    const references = await this.getReferencesInternal(workspaceId, modelId);

    if (references.isDefault || references.agents.length > 0) {
      throw new BusinessException(
        '模型仍被 Agent 或默认运行设置引用，不能删除',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.workspaceModel.delete({ where: { id: modelId } });

    return this.toResponse(model, await this.getDefaultModelId(workspaceId));
  }

  async setDefault(
    userId: string,
    workspaceId: string,
    modelId: string,
  ): Promise<WorkspaceModelResponse> {
    // 默认模型只写运行设置表，不在模型表维护 isDefault，避免多默认状态。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    const model = await this.ensureSelectableModel(workspaceId, modelId);

    // 默认模型统一写入 WorkspaceRuntimeSetting，避免模型表上出现多个默认标记。
    await this.prisma.workspaceRuntimeSetting.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        defaultModelId: model.id,
      },
      update: {
        defaultModelId: model.id,
      },
    });

    return this.toResponse(model, model.id);
  }

  async getReferences(
    userId: string,
    workspaceId: string,
    modelId: string,
  ): Promise<ModelReferenceResponse> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);
    await this.findWorkspaceModelOrThrow(workspaceId, modelId);

    return this.getReferencesInternal(workspaceId, modelId);
  }

  async getDefaultModelId(workspaceId: string): Promise<string | null> {
    const runtimeSetting = await this.prisma.workspaceRuntimeSetting.findUnique(
      {
        where: { workspaceId },
        select: { defaultModelId: true },
      },
    );

    return runtimeSetting?.defaultModelId ?? null;
  }

  async ensureSelectableModel(
    workspaceId: string,
    modelId: string,
  ): Promise<WorkspaceModel> {
    // 可选模型必须同时满足：模型启用、所属 Provider 启用。
    const model = await this.findWorkspaceModelOrThrow(workspaceId, modelId);

    if (!model.enabled) {
      throw new BusinessException(
        '模型已停用',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const provider = await this.prisma.workspaceModelProvider.findFirst({
      where: { id: model.providerId, workspaceId },
    });

    if (!provider?.enabled) {
      throw new BusinessException(
        '模型服务已停用',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    return model;
  }

  async findWorkspaceModelOrThrow(
    workspaceId: string,
    modelId: string,
  ): Promise<WorkspaceModel> {
    const model = await this.prisma.workspaceModel.findFirst({
      where: { id: modelId, workspaceId },
    });

    if (!model) {
      throw new BusinessException(
        '模型不存在或不属于当前工作区',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return model;
  }

  private async getReferencesInternal(
    workspaceId: string,
    modelId: string,
  ): Promise<ModelReferenceResponse> {
    const [agents, runtimeSetting, workflowNodes] = await Promise.all([
      this.prisma.agent.findMany({
        where: { workspaceId, workspaceModelId: modelId },
        select: { id: true, name: true, status: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.workspaceRuntimeSetting.findUnique({
        where: { workspaceId },
        select: { defaultModelId: true },
      }),
      this.findWorkflowNodeReferences(workspaceId, modelId),
    ]);

    return {
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
      })),
      isDefault: runtimeSetting?.defaultModelId === modelId,
      workflowNodes,
    };
  }

  private async findWorkflowNodeReferences(
    workspaceId: string,
    modelId: string,
  ): Promise<Array<{ workflowId: string; workflowName: string }>> {
    const workflows = await this.prisma.workflow.findMany({
      where: { workspaceId },
      select: { id: true, name: true, draftDefinition: true },
    });

    // 工作流定义是 JSON，当前没有结构化索引，只做轻量扫描用于引用提示。
    return workflows
      .filter((workflow) =>
        JSON.stringify(workflow.draftDefinition ?? {}).includes(modelId),
      )
      .map((workflow) => ({
        workflowId: workflow.id,
        workflowName: workflow.name,
      }));
  }

  private async ensureProviderBelongsToWorkspace(
    workspaceId: string,
    providerId: string,
  ): Promise<void> {
    const provider = await this.prisma.workspaceModelProvider.findFirst({
      where: { id: providerId, workspaceId },
      select: { id: true },
    });

    if (!provider) {
      throw new BusinessException(
        '模型服务不存在或不属于当前工作区',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  toResponse(
    model: WorkspaceModel,
    defaultModelId: string | null,
  ): WorkspaceModelResponse {
    return {
      id: model.id,
      workspaceId: model.workspaceId,
      providerId: model.providerId,
      modelId: model.modelId,
      displayName: model.displayName,
      enabled: model.enabled,
      capabilities: model.capabilities,
      contextWindow: model.contextWindow,
      maxOutputTokens: model.maxOutputTokens,
      isDefault: defaultModelId === model.id,
      createdAt: formatShanghaiDateTime(model.createdAt),
      updatedAt: formatShanghaiDateTime(model.updatedAt),
    };
  }

  private toJsonInput(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | undefined {
    return value as Prisma.InputJsonValue | undefined;
  }
}
