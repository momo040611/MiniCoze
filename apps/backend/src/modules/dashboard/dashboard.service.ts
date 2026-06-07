import { Injectable } from '@nestjs/common';
import {
  AgentStatus,
  KnowledgeBaseStatus,
  KnowledgeDocumentStatus,
  PluginInvocationStatus,
  PluginStatus,
  WorkflowRunNodeStatus,
  WorkflowRunStatus,
} from '@prisma/client';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import {
  DashboardAgentSummary,
  DashboardConversationSummary,
  DashboardRunLog,
  DashboardSummary,
  DashboardWorkflowRun,
} from './types/dashboard-summary.type';

const RECENT_ITEMS_LIMIT = 5;
const RECENT_LOG_QUERY_LIMIT = 10;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async getSummary(
    userId: string,
    workspaceId: string,
  ): Promise<DashboardSummary> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const [
      agentCount,
      conversationCount,
      workflowCount,
      pluginCount,
      pluginEnabledCount,
      knowledgeBaseCount,
      knowledgeSyncedCount,
      memberCount,
      publishPendingCount,
      recentAgents,
      recentConversations,
      recentWorkflowRuns,
      recentPluginInvocations,
      recentWorkflowNodes,
    ] = await Promise.all([
      this.prisma.agent.count({
        where: { workspaceId },
      }),
      this.prisma.conversation.count({
        where: {
          agent: { workspaceId },
          isPreview: false,
        },
      }),
      this.prisma.workflow.count({
        where: { workspaceId },
      }),
      this.prisma.pluginDefinition.count({
        where: {
          workspaceId,
          status: {
            not: PluginStatus.ARCHIVED,
          },
        },
      }),
      this.prisma.pluginDefinition.count({
        where: {
          workspaceId,
          status: PluginStatus.ACTIVE,
          invocationEnabled: true,
        },
      }),
      this.prisma.knowledgeBase.count({
        where: {
          workspaceId,
          status: {
            not: KnowledgeBaseStatus.ARCHIVED,
          },
        },
      }),
      this.prisma.knowledgeBase.count({
        where: {
          workspaceId,
          status: {
            not: KnowledgeBaseStatus.ARCHIVED,
          },
          documents: {
            some: {
              status: KnowledgeDocumentStatus.READY,
            },
          },
        },
      }),
      this.prisma.workspaceMember.count({
        where: { workspaceId },
      }),
      this.prisma.agent.count({
        where: {
          workspaceId,
          status: AgentStatus.DRAFT,
        },
      }),
      this.prisma.agent.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        take: RECENT_ITEMS_LIMIT,
        select: {
          id: true,
          name: true,
          description: true,
          avatarUrl: true,
          status: true,
          updatedAt: true,
        },
      }),
      this.prisma.conversation.findMany({
        where: {
          agent: { workspaceId },
          isPreview: false,
        },
        orderBy: { updatedAt: 'desc' },
        take: RECENT_ITEMS_LIMIT,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.workflowRun.findMany({
        where: { workspaceId },
        orderBy: { startedAt: 'desc' },
        take: RECENT_ITEMS_LIMIT,
        select: {
          id: true,
          workflowId: true,
          status: true,
          startedAt: true,
          endedAt: true,
          workflow: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.pluginInvocation.findMany({
        where: {
          plugin: {
            workspaceId,
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
        take: RECENT_LOG_QUERY_LIMIT,
        select: {
          id: true,
          toolCode: true,
          status: true,
          errorSummary: true,
          durationMs: true,
          startedAt: true,
          agent: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.workflowRunNode.findMany({
        where: {
          run: {
            workspaceId,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: RECENT_LOG_QUERY_LIMIT,
        select: {
          id: true,
          nodeId: true,
          nodeType: true,
          status: true,
          errorMessage: true,
          durationMs: true,
          startedAt: true,
          createdAt: true,
          run: {
            select: {
              agent: {
                select: {
                  name: true,
                },
              },
              workflow: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const recentLogs = [
      ...recentPluginInvocations.map((log) => this.toPluginRunLog(log)),
      ...recentWorkflowNodes.map((log) => this.toWorkflowNodeLog(log)),
    ]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, RECENT_ITEMS_LIMIT);

    return {
      agentCount,
      conversationCount,
      workflowCount,
      pluginCount,
      knowledgeBaseCount,
      knowledgeSyncedCount,
      publishPendingCount,
      pluginEnabledCount,
      pluginUpdateCount: 0,
      memberCount,
      recentAgents: recentAgents.map((agent) => this.toAgentSummary(agent)),
      recentConversations: recentConversations.map((conversation) =>
        this.toConversationSummary(conversation),
      ),
      recentWorkflows: recentWorkflowRuns.map((run) =>
        this.toWorkflowRunSummary(run),
      ),
      recentLogs,
    };
  }

  private toAgentSummary(agent: {
    id: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    status: AgentStatus;
    updatedAt: Date;
  }): DashboardAgentSummary {
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description ?? undefined,
      avatarUrl: agent.avatarUrl,
      status: this.toDashboardAgentStatus(agent.status),
      updatedAt: formatShanghaiDateTime(agent.updatedAt),
    };
  }

  private toConversationSummary(conversation: {
    id: string;
    title: string | null;
    updatedAt: Date;
    agent: {
      id: string;
      name: string;
    } | null;
  }): DashboardConversationSummary {
    return {
      id: conversation.id,
      title: conversation.title,
      updatedAt: formatShanghaiDateTime(conversation.updatedAt),
      agent: {
        id: conversation.agent?.id ?? '',
        name: conversation.agent?.name ?? '未知智能体',
      },
    };
  }

  private toWorkflowRunSummary(run: {
    id: string;
    workflowId: string;
    status: WorkflowRunStatus;
    startedAt: Date;
    endedAt: Date | null;
    workflow: {
      name: string;
    };
  }): DashboardWorkflowRun {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workflowName: run.workflow.name,
      status: this.toDashboardWorkflowStatus(run.status),
      startedAt: formatShanghaiDateTime(run.startedAt),
      duration: run.endedAt
        ? run.endedAt.getTime() - run.startedAt.getTime()
        : undefined,
    };
  }

  private toPluginRunLog(log: {
    id: string;
    toolCode: string;
    status: PluginInvocationStatus;
    errorSummary: string | null;
    durationMs: number | null;
    startedAt: Date;
    agent: {
      name: string;
    } | null;
  }): DashboardRunLog {
    const status = this.toPluginLogStatus(log.status);
    const duration = log.durationMs ? `，耗时 ${log.durationMs}ms` : '';
    const error = log.errorSummary ? `，原因：${log.errorSummary}` : '';

    return {
      id: log.id,
      type: 'tool_call',
      agentName: log.agent?.name ?? '系统',
      content:
        status === 'failed'
          ? `调用插件工具 ${log.toolCode} 失败${error}`
          : `调用插件工具 ${log.toolCode}${duration}`,
      timestamp: formatShanghaiDateTime(log.startedAt),
      status,
    };
  }

  private toWorkflowNodeLog(log: {
    id: string;
    nodeId: string;
    nodeType: string;
    status: WorkflowRunNodeStatus;
    errorMessage: string | null;
    durationMs: number | null;
    startedAt: Date | null;
    createdAt: Date;
    run: {
      agent: {
        name: string;
      } | null;
      workflow: {
        name: string;
      };
    };
  }): DashboardRunLog {
    const status = this.toWorkflowNodeLogStatus(log.status);
    const duration = log.durationMs ? `，耗时 ${log.durationMs}ms` : '';
    const error = log.errorMessage ? `，原因：${log.errorMessage}` : '';

    return {
      id: log.id,
      type: 'workflow_step',
      agentName: log.run.agent?.name ?? '工作流',
      content:
        status === 'failed'
          ? `工作流 ${log.run.workflow.name} 节点 ${log.nodeType}(${log.nodeId}) 执行失败${error}`
          : `工作流 ${log.run.workflow.name} 节点 ${log.nodeType}(${log.nodeId}) 已执行${duration}`,
      timestamp: formatShanghaiDateTime(log.startedAt ?? log.createdAt),
      status,
    };
  }

  private toDashboardAgentStatus(status: AgentStatus): string {
    switch (status) {
      case AgentStatus.ACTIVE:
        return 'published';
      case AgentStatus.DRAFT:
        return 'draft';
      case AgentStatus.ARCHIVED:
        return 'archived';
    }
  }

  private toDashboardWorkflowStatus(
    status: WorkflowRunStatus,
  ): 'running' | 'success' | 'failed' {
    switch (status) {
      case WorkflowRunStatus.SUCCEEDED:
        return 'success';
      case WorkflowRunStatus.FAILED:
      case WorkflowRunStatus.CANCELED:
        return 'failed';
      default:
        return 'running';
    }
  }

  private toPluginLogStatus(
    status: PluginInvocationStatus,
  ): 'success' | 'failed' | undefined {
    switch (status) {
      case PluginInvocationStatus.SUCCESS:
        return 'success';
      case PluginInvocationStatus.FAILED:
      case PluginInvocationStatus.TIMEOUT:
      case PluginInvocationStatus.CANCELED:
        return 'failed';
      default:
        return undefined;
    }
  }

  private toWorkflowNodeLogStatus(
    status: WorkflowRunNodeStatus,
  ): 'success' | 'failed' | undefined {
    switch (status) {
      case WorkflowRunNodeStatus.SUCCEEDED:
        return 'success';
      case WorkflowRunNodeStatus.FAILED:
        return 'failed';
      default:
        return undefined;
    }
  }
}
