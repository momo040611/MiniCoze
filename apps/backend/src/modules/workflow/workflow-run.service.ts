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
import { WorkflowAsyncRunner } from './internal/compose/workflow-async-runner';
import {
  WorkflowRunEvent,
  WorkflowStreamEvent,
} from './internal/execute/workflow-run-event';
import { WorkflowRunEventBus } from './internal/execute/workflow-run-event-bus';
import { RunWorkflowDto } from './dto/run-workflow.dto';
import { WorkflowRunQueryDto } from './dto/workflow-run-query.dto';
import {
  parseWorkflowDefinition,
  validateWorkflowDefinition,
} from './workflow-definition.validator';
import { WorkflowMapper } from './workflow.mapper';
import { WorkflowRunResponse } from './types/workflow-run-response.type';

@Injectable()
export class WorkflowRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly workflowAsyncRunner: WorkflowAsyncRunner,
    private readonly workflowMapper: WorkflowMapper,
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
    const definitionSource =
      workflowVersion?.definition ?? workflow.draftDefinition;

    // Step 3) 对工作流定义做运行前校验与解析。
    // 这里会校验 nodes/edges、start/end、节点引用等结构合法性；
    // 不合法直接抛错，不会创建执行节点日志。
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

    // Step 4) 先创建 workflowRun 主记录，状态置为 RUNNING。
    // 这条记录是本次运行的“总账本”，后续每个节点日志都挂在 run.id 下。
    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId,
        workflowVersionId: workflowVersion?.id,
        workspaceId: workflow.workspaceId,
        startedBy: userId,
        status: WorkflowRunStatus.RUNNING,
        input: this.toNullableInputJsonValue(dto.input),
        startedAt: new Date(),
      },
    });
    onEvent?.({ type: 'run.created', runId: run.id });

    // Step 5) 初始化事件总线，订阅节点事件并写入 WorkflowRunNode。
    // 事件来源是 runner（node.started / node.completed / node.failed）。
    // - node.started: 仅记录开始时间到内存 map
    // - node.completed/node.failed: 写一条节点执行日志到数据库
    const eventBus = new WorkflowRunEventBus();
    const startedAtMap = new Map<string, Date>();
    eventBus.subscribe(async (event: WorkflowRunEvent) => {
      // 先把节点事件转发给 SSE（实时进度），再落库。
      onEvent?.(event);

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
      // Step 6) 真正执行工作流（当前基础版 runner 支持单路径 start->...->end）。
      // runner 内部会在节点生命周期中不断 publish 事件，上面的订阅者会实时落库。
      const runOutput = await this.workflowAsyncRunner.run({
        runId: run.id,
        definition,
        input: dto.input ?? {},
        eventBus,
      });

      // Step 7) 所有节点执行成功后，更新 run 为 SUCCEEDED 并写最终 output。
      const finalOutput = {
        ...runOutput.output,
        workflowId,
        workflowVersion: workflowVersion?.version ?? null,
      };
      const updatedRun = await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.SUCCEEDED,
          output: this.toInputJsonValue(finalOutput),
          endedAt: new Date(),
        },
        include: {
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      onEvent?.({ type: 'run.completed', runId: run.id, output: finalOutput });
      // Step 8) 返回运行详情（含节点日志），给 API 层直接响应前端。
      return this.workflowMapper.toWorkflowRunResponse(updatedRun, true);
    } catch (error) {
      // 失败分支：
      // - 捕获执行异常
      // - 更新 run 状态为 FAILED，写 errorMessage
      // - 保留已写入的节点日志用于排障
      const message = error instanceof Error ? error.message : String(error);
      const failedRun = await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: WorkflowRunStatus.FAILED,
          errorMessage: message,
          endedAt: new Date(),
        },
        include: {
          nodes: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      onEvent?.({ type: 'run.failed', runId: run.id, error: message });
      return this.workflowMapper.toWorkflowRunResponse(failedRun, true);
    } finally {
      // 无论成功失败，最后都发一个 stream.done，告诉 SSE 客户端可以关闭了。
      onEvent?.({ type: 'stream.done', runId: run.id });
    }
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
