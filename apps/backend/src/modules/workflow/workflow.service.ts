import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, WorkflowStatus } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { PublishWorkflowDto } from './dto/publish-workflow.dto';
import { SaveWorkflowDraftDto } from './dto/save-workflow-draft.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowQueryDto } from './dto/workflow-query.dto';
import { validateWorkflowDefinition } from './workflow-definition.validator';
import { WorkflowMapper } from './workflow.mapper';
import { WorkflowResponse } from './types/workflow-response.type';
import { WorkflowVersionResponse } from './types/workflow-version-response.type';

// WorkflowService 仅负责工作流配置面主流程编排：
// create/list/detail/draft/validate/publish/version
@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly workflowMapper: WorkflowMapper,
  ) {}

  // 创建工作流：
  // - userId: 当前操作用户
  // - dto.workspaceId/name/description/definition: 创建参数
  // 返回：创建后的工作流详情（含草稿定义与当前版本信息）
  async create(
    userId: string,
    dto: CreateWorkflowDto,
  ): Promise<WorkflowResponse> {
    await this.workspaceAccessService.ensureCanManage(userId, dto.workspaceId);

    const workflow = await this.prisma.workflow.create({
      data: {
        workspaceId: dto.workspaceId,
        creatorId: userId,
        name: dto.name,
        description: dto.description,
        status: WorkflowStatus.DRAFT,
        draftDefinition: this.toInputJsonValue(
          dto.definition ?? this.getDefaultDefinition(),
        ),
      },
      include: {
        currentVersion: true,
      },
    });

    return this.workflowMapper.toWorkflowResponse(workflow);
  }

  // 查询工作流列表：
  // - userId: 当前用户（用于权限校验）
  // - query: workspaceId + 分页 + 状态/关键词筛选
  // 返回：分页列表
  async findByWorkspace(userId: string, query: WorkflowQueryDto) {
    await this.workspaceAccessService.ensureMember(userId, query.workspaceId);
    const { page, pageSize, workspaceId, status, keyword } = query;

    const where: Prisma.WorkflowWhereInput = {
      workspaceId,
      status,
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [workflows, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where,
        include: { currentVersion: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workflow.count({ where }),
    ]);

    return createPaginatedData({
      list: workflows.map((workflow) =>
        this.workflowMapper.toWorkflowResponse(workflow),
      ),
      total,
      page,
      pageSize,
    });
  }

  // 查询单个工作流详情：
  // - userId: 当前用户（成员可读）
  // - workflowId: 工作流 ID
  async findOneForUser(
    userId: string,
    workflowId: string,
  ): Promise<WorkflowResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureMember(
      userId,
      workflow.workspaceId,
    );

    return this.workflowMapper.toWorkflowResponse(workflow);
  }

  // 更新工作流基础信息：
  // - userId: 当前用户（需管理权限）
  // - workflowId: 工作流 ID
  // - dto: 可更新的基础字段（name/description）
  async update(
    userId: string,
    workflowId: string,
    dto: UpdateWorkflowDto,
  ): Promise<WorkflowResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );

    const updated = await this.prisma.workflow.update({
      where: { id: workflowId },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: { currentVersion: true },
    });

    return this.workflowMapper.toWorkflowResponse(updated);
  }

  // 保存草稿定义：
  // - userId: 当前用户（需管理权限）
  // - workflowId: 工作流 ID
  // - dto.definition: 画布定义
  // 返回：更新后的工作流详情
  async saveDraft(
    userId: string,
    workflowId: string,
    dto: SaveWorkflowDraftDto,
  ): Promise<WorkflowResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );

    const updated = await this.prisma.workflow.update({
      where: { id: workflowId },
      data: {
        draftDefinition: this.toInputJsonValue(dto.definition),
        status:
          workflow.status === WorkflowStatus.ARCHIVED
            ? WorkflowStatus.ARCHIVED
            : WorkflowStatus.DRAFT,
      },
      include: { currentVersion: true },
    });

    return this.workflowMapper.toWorkflowResponse(updated);
  }

  // 校验草稿定义是否合法：
  // - userId: 当前用户（成员可读）
  // - workflowId: 工作流 ID
  // 返回：valid/errors/warnings 等校验结果
  async validateDraft(userId: string, workflowId: string) {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureMember(
      userId,
      workflow.workspaceId,
    );

    return validateWorkflowDefinition(workflow.draftDefinition);
  }

  // 发布工作流版本：
  // - userId: 当前用户（需管理权限）
  // - workflowId: 工作流 ID
  // - dto.inputSchema/outputSchema: 版本输入输出契约（可选）
  // 返回：新发布版本
  async publish(
    userId: string,
    workflowId: string,
    dto: PublishWorkflowDto,
  ): Promise<WorkflowVersionResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );

    const validation = validateWorkflowDefinition(workflow.draftDefinition);
    if (!validation.valid) {
      throw new BusinessException(
        `工作流校验失败：${validation.errors.join('; ')}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    const draftDefinition =
      this.workflowMapper.toObjectOrNull(workflow.draftDefinition) ??
      this.getDefaultDefinition();

    const result = await this.prisma.$transaction(async (tx) => {
      const latestVersion = await tx.workflowVersion.findFirst({
        where: { workflowId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (latestVersion?.version ?? 0) + 1;
      const publishedAt = new Date();

      const createdVersion = await tx.workflowVersion.create({
        data: {
          workflowId,
          createdBy: userId,
          version: nextVersion,
          definition: this.toInputJsonValue(draftDefinition),
          inputSchema: this.toNullableInputJsonValue(dto.inputSchema),
          outputSchema: this.toNullableInputJsonValue(dto.outputSchema),
          isPublished: true,
          publishedAt,
        },
      });

      await tx.workflow.update({
        where: { id: workflowId },
        data: {
          currentVersionId: createdVersion.id,
          status: WorkflowStatus.ACTIVE,
        },
      });

      return createdVersion;
    });

    return this.workflowMapper.toWorkflowVersionResponse(result);
  }

  // 查询版本列表：
  // - userId: 当前用户（成员可读）
  // - workflowId: 工作流 ID
  // 返回：版本列表（按 version 倒序）
  async listVersions(
    userId: string,
    workflowId: string,
  ): Promise<WorkflowVersionResponse[]> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureMember(
      userId,
      workflow.workspaceId,
    );

    const versions = await this.prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: 'desc' },
    });

    return versions.map((version) =>
      this.workflowMapper.toWorkflowVersionResponse(version),
    );
  }

  private async findWorkflowOrThrow(workflowId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { currentVersion: true },
    });

    if (!workflow) {
      throw new BusinessException(
        '工作流不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return workflow;
  }

  private getDefaultDefinition(): Record<string, unknown> {
    return {
      nodes: [
        { id: 'start-1', type: 'start' },
        { id: 'end-1', type: 'end' },
      ],
      edges: [{ source: 'start-1', target: 'end-1' }],
    };
  }

  private toInputJsonValue(
    value: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private toNullableInputJsonValue(
    value?: Record<string, unknown>,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (!value) {
      return undefined;
    }
    return value as Prisma.InputJsonValue;
  }
}
