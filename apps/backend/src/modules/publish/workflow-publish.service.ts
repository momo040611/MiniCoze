import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  PublishAction,
  PublishTargetType,
  WorkflowStatus,
  WorkflowVersion,
} from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { PublishWorkflowDto } from '../workflow/dto/publish-workflow.dto';
import { WorkflowVersionResponse } from '../workflow/types/workflow-version-response.type';
import { validateWorkflowDefinition } from '../workflow/workflow-definition.validator';
import { OfflineWorkflowDto } from './dto/offline-workflow.dto';
import { RollbackWorkflowDto } from './dto/rollback-workflow.dto';
import { PublishChannelService } from './publish-channel.service';
import { PublishRecordService } from './publish-record.service';
import {
  PublishCheckItem,
  PublishCheckResponse,
  PublishRecordListItem,
} from './types/publish.types';

@Injectable()
export class WorkflowPublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly publishChannelService: PublishChannelService,
    private readonly publishRecordService: PublishRecordService,
  ) {}

  async checkWorkflow(
    userId: string,
    workflowId: string,
  ): Promise<PublishCheckResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );

    const items = this.buildPublishCheckItems(workflow);
    return {
      passed: items.every((item) => item.passed),
      items,
    };
  }

  async publishWorkflow(
    userId: string,
    workflowId: string,
    dto: PublishWorkflowDto,
  ): Promise<WorkflowVersionResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );

    this.assertWorkflowCanPublish(workflow);
    const draftDefinition =
      this.toObjectOrNull(workflow.draftDefinition) ??
      this.getDefaultDefinition();

      const createdVersion = await this.publishVersionWithRetry({
      userId,
      workflowId,
      workspaceId: workflow.workspaceId,
      dto,
      draftDefinition,
    });

    return this.toWorkflowVersionResponse(createdVersion);
  }

    /**
   * 事务里「查最大版本号 → +1 → 插入」，并发时会算出同一个号，
   * 后提交的那个撞上 @@unique([workflowId, version])，抛 P2002。
   *
   * 处理方式：撞了就重试一次 —— 新事务能看到对方已提交的版本号，第二次会算出 v5。
   * 再撞说明确实有人在同时发布，返回 409 让人稍后重试，而不是 500。
   */
  private async publishVersionWithRetry(input: {
    userId: string;
    workflowId: string;
    workspaceId: string;
    dto: PublishWorkflowDto;
    draftDefinition: Record<string, unknown>;
  }): Promise<WorkflowVersion> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const latestVersion = await tx.workflowVersion.findFirst({
            where: { workflowId: input.workflowId },
            orderBy: { version: 'desc' },
          });
          const nextVersion = (latestVersion?.version ?? 0) + 1;
          const publishedAt = new Date();

          const createdVersion = await tx.workflowVersion.create({
            data: {
              workflowId: input.workflowId,
              createdBy: input.userId,
              version: nextVersion,
              definition: this.toInputJsonValue(input.draftDefinition),
              inputSchema: this.toNullableInputJsonValue(input.dto.inputSchema),
              outputSchema: this.toNullableInputJsonValue(
                input.dto.outputSchema,
              ),
              changelog: input.dto.changelog,
              isPublished: true,
              publishedAt,
            },
          });

          await tx.workflow.update({
            where: { id: input.workflowId },
            data: {
              currentVersionId: createdVersion.id,
              status: WorkflowStatus.ACTIVE,
            },
          });

          await this.publishRecordService.createWorkflowRecord(tx, {
            workspaceId: input.workspaceId,
            workflowId: input.workflowId,
            versionId: createdVersion.id,
            versionNumber: createdVersion.version,
            action: PublishAction.PUBLISH,
            reason: input.dto.changelog,
            operatorId: input.userId,
          });

          await this.publishChannelService.ensureDefaultWorkflowApiChannel(tx, {
            id: input.workflowId,
            workspaceId: input.workspaceId,
          });

          return createdVersion;
        });
      } catch (error) {
        if (!this.isVersionConflict(error)) {
          throw error;
        }
        if (attempt === 2) {
          break;
        }
      }
    }

    throw new BusinessException(
      '该工作流正在被其他人发布，请稍后重试',
      ErrorCode.Conflict,
      HttpStatus.CONFLICT,
    );
  }

  /** 只有「唯一约束冲突」才值得重试，其它错误原样抛出。 */
  private isVersionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
  async listWorkflowVersions(
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

    return versions.map((version) => this.toWorkflowVersionResponse(version));
  }

  async listWorkflowRecords(
    userId: string,
    workflowId: string,
  ): Promise<PublishRecordListItem[]> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureMember(
      userId,
      workflow.workspaceId,
    );

    return this.publishRecordService.listWorkflowRecords(workflowId);
  }

  async rollbackWorkflow(
    userId: string,
    workflowId: string,
    dto: RollbackWorkflowDto,
  ) {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );

    const version = await this.prisma.workflowVersion.findFirst({
      where: {
        id: dto.versionId,
        workflowId,
        isPublished: true,
      },
    });

    if (!version) {
      throw new BusinessException(
        '工作流发布版本不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const rolledBackAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.workflow.update({
        where: { id: workflowId },
        data: {
          currentVersionId: version.id,
          status: WorkflowStatus.ACTIVE,
        },
      });

      await this.publishRecordService.createWorkflowRecord(tx, {
        workspaceId: workflow.workspaceId,
        workflowId,
        versionId: version.id,
        versionNumber: version.version,
        action: PublishAction.ROLLBACK,
        reason: dto.reason,
        operatorId: userId,
        createdAt: rolledBackAt,
      });
    });

    return {
      currentVersionId: version.id,
      version: version.version,
      rolledBackAt: formatShanghaiDateTime(rolledBackAt),
    };
  }

  async offlineWorkflow(
    userId: string,
    workflowId: string,
    dto: OfflineWorkflowDto,
  ) {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );

    if (!workflow.currentVersionId) {
      throw new BusinessException(
        '工作流尚未发布，无法下线',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const offlineAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.workflow.update({
        where: { id: workflowId },
        data: {
          status: WorkflowStatus.DRAFT,
        },
      });
      await tx.publishChannel.updateMany({
        where: {
          targetType: PublishTargetType.WORKFLOW,
          targetId: workflowId,
        },
        data: {
          enabled: false,
        },
      });

      await this.publishRecordService.createWorkflowRecord(tx, {
        workspaceId: workflow.workspaceId,
        workflowId,
        versionId: workflow.currentVersionId,
        versionNumber: workflow.currentVersion?.version,
        action: PublishAction.OFFLINE,
        reason: dto.reason,
        operatorId: userId,
        createdAt: offlineAt,
      });
    });

    return {
      versionId: workflow.currentVersionId,
      version: workflow.currentVersion?.version ?? null,
      offlineAt: formatShanghaiDateTime(offlineAt),
    };
  }

  private buildPublishCheckItems(
    workflow: Prisma.WorkflowGetPayload<{ include: { currentVersion: true } }>,
  ): PublishCheckItem[] {
    const validation = validateWorkflowDefinition(workflow.draftDefinition);
    return [
      {
        key: 'name',
        label: '工作流名称',
        passed: workflow.name.trim().length > 0,
        message:
          workflow.name.trim().length > 0
            ? '工作流名称已配置'
            : '工作流名称不能为空',
      },
      {
        key: 'status',
        label: '工作流状态',
        passed: workflow.status !== WorkflowStatus.ARCHIVED,
        message:
          workflow.status !== WorkflowStatus.ARCHIVED
            ? '工作流状态允许发布'
            : '已归档工作流不能发布',
      },
      {
        key: 'definition',
        label: '草稿定义',
        passed: validation.valid,
        message: validation.valid
          ? `草稿校验通过：${validation.nodeCount} 个节点，${validation.edgeCount} 条连线`
          : validation.errors.join('；'),
      },
    ];
  }

    private assertWorkflowCanPublish(
    workflow: Prisma.WorkflowGetPayload<{ include: { currentVersion: true } }>,
  ): void {
    // 已归档是「状态冲突」：资源存在、请求合法，但当前状态不允许该操作。
    if (workflow.status === WorkflowStatus.ARCHIVED) {
      throw new BusinessException(
        '已归档工作流不能发布',
        ErrorCode.Conflict,
        HttpStatus.CONFLICT,
      );
    }

    // 其余检查失败是「语义不通过」：格式没问题，是内容不满足发布条件。
    const failedItems = this.buildPublishCheckItems(workflow).filter(
      (item) => !item.passed,
    );
    if (failedItems.length) {
      throw new BusinessException(
        `工作流发布检查未通过：${failedItems
          .map((item) => item.message ?? item.label)
          .join('；')}`,
        ErrorCode.UnprocessableEntity,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
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

  private toWorkflowVersionResponse(
    workflowVersion: Prisma.WorkflowVersionGetPayload<object>,
  ): WorkflowVersionResponse {
    return {
      id: workflowVersion.id,
      workflowId: workflowVersion.workflowId,
      createdBy: workflowVersion.createdBy,
      version: workflowVersion.version,
      definition: this.toObjectOrEmpty(workflowVersion.definition),
      inputSchema: this.toObjectOrNull(workflowVersion.inputSchema),
      outputSchema: this.toObjectOrNull(workflowVersion.outputSchema),
      changelog:
        (workflowVersion as { changelog?: string | null }).changelog ?? null,
      isPublished: workflowVersion.isPublished,
      publishedAt: workflowVersion.publishedAt
        ? formatShanghaiDateTime(workflowVersion.publishedAt)
        : null,
      createdAt: formatShanghaiDateTime(workflowVersion.createdAt),
      updatedAt: formatShanghaiDateTime(workflowVersion.updatedAt),
    };
  }

  private toObjectOrNull(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value;
  }

  private toObjectOrEmpty(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value;
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
