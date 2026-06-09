import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  PublishAction,
  PublishTargetType,
  WorkflowStatus,
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
          changelog: dto.changelog,
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

      await this.publishRecordService.createWorkflowRecord(tx, {
        workspaceId: workflow.workspaceId,
        workflowId,
        versionId: createdVersion.id,
        versionNumber: createdVersion.version,
        action: PublishAction.PUBLISH,
        reason: dto.changelog,
        operatorId: userId,
      });

      await this.publishChannelService.ensureDefaultWorkflowApiChannel(tx, {
        id: workflowId,
        workspaceId: workflow.workspaceId,
      });

      return createdVersion;
    });

    return this.toWorkflowVersionResponse(result);
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
    const failedItems = this.buildPublishCheckItems(workflow).filter(
      (item) => !item.passed,
    );
    if (failedItems.length) {
      throw new BusinessException(
        `工作流发布检查未通过：${failedItems
          .map((item) => item.message ?? item.label)
          .join('；')}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
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
