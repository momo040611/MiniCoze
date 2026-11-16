import { HttpStatus, Injectable } from '@nestjs/common';
import { AgentRun, AgentRunSource, AgentRunStatus } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import type { PaginatedData } from '../../common/types/pagination-response.type';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { AgentRunQueryDto } from './dto/agent-run-query.dto';
import { RunControlService } from './run-control.service';

export interface AgentRunResponse {
  id: string;
  runId: string;
  agentId: string;
  agentName?: string;
  conversationId: string;
  source: AgentRunSource;
  isPreview: boolean;
  status: AgentRunStatus;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  toolCallCount: number;
  durationMs: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/**
 * Agent 运行记录查询与取消：
 * - 列表/详情：登录用户须是运行所属工作区成员。
 * - 取消：运行发起人或同工作区成员可取消在途运行。
 */
@Injectable()
export class AgentRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runControlService: RunControlService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async list(
    userId: string,
    query: AgentRunQueryDto,
  ): Promise<PaginatedData<AgentRunResponse>> {
    const { page, pageSize, agentId, workspaceId, status, source } = query;

    if (agentId) {
      await this.ensureAgentAccess(userId, agentId);
    } else if (workspaceId) {
      await this.workspaceAccessService.ensureMember(userId, workspaceId);
    } else {
      throw new BusinessException(
        'agentId 与 workspaceId 至少提供一个',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const where = {
      ...(agentId ? { agentId } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.agentRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.agentRun.count({ where }),
    ]);

    const agentIds = [...new Set(rows.map((row) => row.agentId))];
    const agents = agentIds.length
      ? await this.prisma.agent.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        })
      : [];
    const agentNameMap = new Map(agents.map((agent) => [agent.id, agent.name]));

    return createPaginatedData({
      list: rows.map((row) => this.toResponse(row, agentNameMap.get(row.agentId))),
      total,
      page,
      pageSize,
    });
  }

  async get(userId: string, runId: string): Promise<AgentRunResponse> {
    const run = await this.prisma.agentRun.findUnique({ where: { runId } });
    if (!run) {
      throw new BusinessException(
        '运行记录不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.workspaceAccessService.ensureMember(userId, run.workspaceId);
    const agent = await this.prisma.agent.findUnique({
      where: { id: run.agentId },
      select: { name: true },
    });

    return this.toResponse(run, agent?.name);
  }

  async cancel(userId: string, runId: string): Promise<void> {
    const entry = this.runControlService.get(runId);

    if (!entry) {
      // 没有在途控制器：要么已终态，要么进程重启。查 DB 给出准确提示。
      const run = await this.prisma.agentRun.findUnique({
        where: { runId },
        select: { status: true, workspaceId: true },
      });

      if (!run) {
        throw new BusinessException(
          '运行记录不存在',
          ErrorCode.NotFound,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new BusinessException(
        run.status === AgentRunStatus.IN_PROGRESS || run.status === AgentRunStatus.CREATED
          ? '运行不在当前实例中，无法取消（可能发生在进程重启前）'
          : '运行已结束，无需取消',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (entry.userId !== userId) {
      // 非发起人：需为同工作区成员（OWNER/ADMIN/MEMBER 均可，取消属于协作操作）。
      await this.workspaceAccessService.ensureMember(userId, entry.workspaceId);
    }

    const result = this.runControlService.cancel(runId, userId);
    if (result !== 'canceled') {
      throw new BusinessException(
        '取消失败，运行可能刚刚结束',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async ensureAgentAccess(userId: string, agentId: string): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { workspaceId: true },
    });

    if (!agent) {
      throw new BusinessException(
        'Agent 不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);
  }

  private toResponse(row: AgentRun, agentName?: string): AgentRunResponse {
    return {
      id: row.id,
      runId: row.runId,
      agentId: row.agentId,
      agentName,
      conversationId: row.conversationId,
      source: row.source,
      isPreview: row.isPreview,
      status: row.status,
      model: row.model,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      toolCallCount: row.toolCallCount,
      durationMs: row.durationMs,
      error: row.error,
      startedAt: formatShanghaiDateTime(row.startedAt),
      finishedAt: row.finishedAt ? formatShanghaiDateTime(row.finishedAt) : null,
    };
  }
}
