import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  WorkflowRunNodeStatus,
  WorkflowRunStatus,
} from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { RunWorkflowDto } from './dto/run-workflow.dto';
import { WorkflowRunQueryDto } from './dto/workflow-run-query.dto';
import { WorkflowAsyncRunner } from './internal/compose/workflow-async-runner';
import {
  WorkflowCanceledError,
  WorkflowCancellationRegistry,
} from './internal/execute/workflow-cancellation.registry';
import {
  WorkflowRunEvent,
  WorkflowStreamEvent,
} from './internal/execute/workflow-run-event';
import { WorkflowRunEventBus } from './internal/execute/workflow-run-event-bus';
import {
  parseWorkflowDefinition,
  validateWorkflowDefinition,
} from './workflow-definition.validator';
import { WorkflowMapper } from './workflow.mapper';
import { WorkflowRunResponse } from './types/workflow-run-response.type';

type WorkflowWithCurrentVersion = Prisma.WorkflowGetPayload<{
  include: { currentVersion: true };
}>;

type WorkflowVersionWithWorkflow = Prisma.WorkflowVersionGetPayload<{
  include: {
    workflow: {
      include: { currentVersion: true };
    };
  };
}>;

@Injectable()
export class WorkflowRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly workflowAsyncRunner: WorkflowAsyncRunner,
    private readonly workflowMapper: WorkflowMapper,
    private readonly cancellationRegistry: WorkflowCancellationRegistry,
  ) {}

  // run 支持可选的 onEvent 回调：
  // - 普通调用（onEvent 不传）：同步执行，最后返回完整运行详情
  // - 流式调用（onEvent 传入）：执行过程中实时回调运行级/节点级事件（供 SSE 推送）
  async run(
    userId: string,
    workflowId: string,
    dto: RunWorkflowDto,
    onEvent?: (event: WorkflowStreamEvent) => void,
  ): Promise<WorkflowRunResponse> {
    // Step 1) 读取工作流并做权限校验（至少是 workspace 成员才能运行）
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureMember(
      userId,
      workflow.workspaceId,
    );

    // Step 2) 确定运行版本：
    // - 传了 dto.version -> 运行指定版本
    // - 没传 dto.version -> 优先当前发布版本，兜底草稿定义
    const workflowVersion = await this.resolveRunVersion(
      workflowId,
      dto.version,
    );

    return this.executeRun({
      userId,
      workflow,
      workflowVersion,
      input: dto.input,
      onEvent,
    });
  }

  async runWithVersionId(input: {
    userId: string;
    workflowVersionId: string;
    input?: Record<string, unknown>;
    agentId?: string;
    conversationId?: string;
    messageId?: string;
    onEvent?: (event: WorkflowStreamEvent) => void;
  }): Promise<WorkflowRunResponse> {
    const workflowVersion = await this.prisma.workflowVersion.findUnique({
      where: { id: input.workflowVersionId },
      include: {
        workflow: {
          include: {
            currentVersion: true,
          },
        },
      },
    });

    if (!workflowVersion?.workflow) {
      throw new BusinessException(
        '工作流版本不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!workflowVersion.isPublished) {
      throw new BusinessException(
        '工作流版本尚未发布，无法运行',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.workspaceAccessService.ensureMember(
      input.userId,
      workflowVersion.workflow.workspaceId,
    );

    return this.executeRun({
      userId: input.userId,
      workflow: workflowVersion.workflow,
      workflowVersion,
      input: input.input,
      agentId: input.agentId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      onEvent: input.onEvent,
    });
  }

  async runPublishedWorkflow(input: {
    workflowId: string;
    workflowVersionId: string;
    startedBy: string;
    input?: Record<string, unknown>;
    onEvent?: (event: WorkflowStreamEvent) => void;
  }): Promise<WorkflowRunResponse> {
    const workflowVersion = await this.prisma.workflowVersion.findFirst({
      where: {
        id: input.workflowVersionId,
        workflowId: input.workflowId,
        isPublished: true,
      },
      include: {
        workflow: {
          include: {
            currentVersion: true,
          },
        },
      },
    });

    if (!workflowVersion?.workflow) {
      throw new BusinessException(
        '工作流发布版本不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return this.executeRun({
      userId: input.startedBy,
      workflow: workflowVersion.workflow,
      workflowVersion,
      input: input.input,
      onEvent: input.onEvent,
    });
  }

  async requestCancel(
    userId: string,
    runId: string,
  ): Promise<{ runId: string; requested: boolean }> {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { workflow: true },
    });

    if (!run) {
      throw new BusinessException(
        'Workflow Run 不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.workspaceAccessService.ensureMember(
      userId,
      run.workflow.workspaceId,
    );

    if (run.status !== WorkflowRunStatus.RUNNING) {
      return { runId, requested: false };
    }

    this.cancellationRegistry.request(runId);
    return { runId, requested: true };
  }

  async listRuns(
    userId: string,
    workflowId: string,
    query: WorkflowRunQueryDto,
  ) {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureMember(
      userId,
      workflow.workspaceId,
    );

    const { page, pageSize, status } = query;
    const where: Prisma.WorkflowRunWhereInput = {
      workflowId,
      status,
    };

    const [runs, total] = await Promise.all([
      this.prisma.workflowRun.findMany({
        where,
        include: {
          workflow: true,
          workflowVersion: true,
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workflowRun.count({ where }),
    ]);

    return createPaginatedData({
      list: runs.map((run) =>
        this.workflowMapper.toWorkflowRunResponse(run, false),
      ),
      total,
      page,
      pageSize,
    });
  }

  async findRunForUser(
    userId: string,
    runId: string,
  ): Promise<WorkflowRunResponse> {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: true,
        workflowVersion: true,
        nodes: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!run) {
      throw new BusinessException(
        'Workflow Run 不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.workspaceAccessService.ensureMember(
      userId,
      run.workflow.workspaceId,
    );

    return this.workflowMapper.toWorkflowRunResponse(run, true);
  }

  private async executeRun(input: {
    userId: string;
    workflow: WorkflowWithCurrentVersion;
    workflowVersion: Prisma.WorkflowVersionGetPayload<object> | null;
    input?: Record<string, unknown>;
    agentId?: string;
    conversationId?: string;
    messageId?: string;
    onEvent?: (event: WorkflowStreamEvent) => void;
  }): Promise<WorkflowRunResponse> {
    const definitionSource =
      input.workflowVersion?.definition ?? input.workflow.draftDefinition;
    const validation = validateWorkflowDefinition(definitionSource);

    if (!validation.valid) {
      throw new BusinessException(
        `当前工作流不可运行：${validation.errors.join('; ')}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const definition = parseWorkflowDefinition(definitionSource);
    if (!definition) {
      throw new BusinessException(
        '工作流定义无效，无法解析执行图',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId: input.workflow.id,
        workflowVersionId: input.workflowVersion?.id,
        workspaceId: input.workflow.workspaceId,
        agentId: input.agentId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        startedBy: input.userId,
        status: WorkflowRunStatus.RUNNING,
        input: this.toNullableInputJsonValue(input.input),
        startedAt: new Date(),
      },
    });
    input.onEvent?.({ type: 'run.created', runId: run.id });

    const eventBus = new WorkflowRunEventBus();
    const startedAtMap = new Map<string, Date>();
    eventBus.subscribe(async (event: WorkflowRunEvent) => {
      input.onEvent?.(event);

      if (event.type === 'node.started') {
        startedAtMap.set(event.nodeId, event.at);
        return;
      }

      const status =
        event.type === 'node.completed'
          ? WorkflowRunNodeStatus.SUCCEEDED
          : WorkflowRunNodeStatus.FAILED;
      const nodeStartedAt = startedAtMap.get(event.nodeId) ?? event.at;

      await this.prisma.workflowRunNode.create({
        data: {
          runId: run.id,
          nodeId: event.nodeId,
          nodeType: event.nodeType,
          status,
          input: event.input ? this.toInputJsonValue(event.input) : undefined,
          output: event.output
            ? this.toInputJsonValue(event.output)
            : undefined,
          errorMessage: event.errorMessage,
          durationMs: event.durationMs ?? this.diffMs(nodeStartedAt, event.at),
          startedAt: nodeStartedAt,
          endedAt: event.at,
        },
      });
    });

    try {
      const runOutput = await this.workflowAsyncRunner.run({
        runId: run.id,
        definition,
        input: input.input ?? {},
        eventBus,
        isCanceled: () => this.cancellationRegistry.isCanceled(run.id),
      });

      const finalOutput = {
        ...runOutput.output,
        workflowId: input.workflow.id,
        workflowVersion: input.workflowVersion?.version ?? null,
      };

      const updatedRun = await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.SUCCEEDED,
          output: this.toInputJsonValue(finalOutput),
          endedAt: new Date(),
        },
        include: {
          workflow: true,
          workflowVersion: true,
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      input.onEvent?.({
        type: 'run.completed',
        runId: run.id,
        output: finalOutput,
      });

      return this.workflowMapper.toWorkflowRunResponse(updatedRun, true);
    } catch (error) {
      const canceled = error instanceof WorkflowCanceledError;
      const message = error instanceof Error ? error.message : String(error);
      const endedRun = await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: canceled
            ? WorkflowRunStatus.CANCELED
            : WorkflowRunStatus.FAILED,
          errorMessage: message,
          endedAt: new Date(),
        },
        include: {
          workflow: true,
          workflowVersion: true,
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      input.onEvent?.({ type: 'run.failed', runId: run.id, error: message });
      return this.workflowMapper.toWorkflowRunResponse(endedRun, true);
    } finally {
      this.cancellationRegistry.clear(run.id);
      input.onEvent?.({ type: 'stream.done', runId: run.id });
    }
  }

  private async resolveRunVersion(workflowId: string, version?: number) {
    if (!version) {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { currentVersion: true },
      });
      return workflow?.currentVersion ?? null;
    }

    const workflowVersion = await this.prisma.workflowVersion.findUnique({
      where: {
        workflowId_version: {
          workflowId,
          version,
        },
      },
    });

    if (!workflowVersion) {
      throw new BusinessException(
        `Workflow 版本不存在: v${version}`,
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return workflowVersion;
  }

  private async findWorkflowOrThrow(
    workflowId: string,
  ): Promise<WorkflowWithCurrentVersion> {
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

  private diffMs(start: Date, end: Date): number {
    return Math.max(0, end.getTime() - start.getTime());
  }
}
