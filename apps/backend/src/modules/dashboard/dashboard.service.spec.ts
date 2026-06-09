import { Test, TestingModule } from '@nestjs/testing';
import {
  AgentStatus,
  PluginInvocationStatus,
  WorkflowRunNodeStatus,
  WorkflowRunStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { DashboardService } from './dashboard.service';

const now = new Date('2026-06-06T00:00:00.000Z');

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    agent: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    conversation: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    workflow: {
      count: jest.Mock;
    };
    pluginDefinition: {
      count: jest.Mock;
    };
    knowledgeBase: {
      count: jest.Mock;
    };
    pluginInvocation: {
      findMany: jest.Mock;
    };
    workflowRun: {
      findMany: jest.Mock;
    };
    workflowRunNode: {
      findMany: jest.Mock;
    };
    workspaceMember: {
      count: jest.Mock;
    };
  };
  let workspaceAccessService: {
    ensureMember: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      agent: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      conversation: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      workflow: {
        count: jest.fn(),
      },
      pluginDefinition: {
        count: jest.fn(),
      },
      knowledgeBase: {
        count: jest.fn(),
      },
      pluginInvocation: {
        findMany: jest.fn(),
      },
      workflowRun: {
        findMany: jest.fn(),
      },
      workflowRunNode: {
        findMany: jest.fn(),
      },
      workspaceMember: {
        count: jest.fn(),
      },
    };
    workspaceAccessService = {
      ensureMember: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: WorkspaceAccessService,
          useValue: workspaceAccessService,
        },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('returns dashboard summary with aggregated counts, recent workflows and logs', async () => {
    workspaceAccessService.ensureMember.mockResolvedValue({
      id: 'member-id',
    });
    prisma.agent.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    prisma.conversation.count.mockResolvedValue(3);
    prisma.workflow.count.mockResolvedValue(4);
    prisma.pluginDefinition.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3);
    prisma.knowledgeBase.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.workspaceMember.count.mockResolvedValue(6);
    prisma.agent.findMany.mockResolvedValue([
      {
        id: 'agent-1',
        name: '客服助手',
        description: '自动处理客户问题',
        avatarUrl: null,
        status: AgentStatus.ACTIVE,
        updatedAt: now,
      },
      {
        id: 'agent-2',
        name: '草稿助手',
        description: null,
        avatarUrl: 'https://example.com/avatar.png',
        status: AgentStatus.DRAFT,
        updatedAt: now,
      },
    ]);
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conversation-1',
        title: '最近一次对话',
        updatedAt: now,
        agent: {
          id: 'agent-1',
          name: '客服助手',
        },
      },
    ]);
    prisma.workflowRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        workflowId: 'workflow-1',
        status: WorkflowRunStatus.SUCCEEDED,
        startedAt: now,
        endedAt: new Date(now.getTime() + 12_000),
        workflow: {
          name: '订单回访',
        },
      },
    ]);
    prisma.pluginInvocation.findMany.mockResolvedValue([
      {
        id: 'plugin-log-1',
        toolCode: 'search_web',
        status: PluginInvocationStatus.SUCCESS,
        errorSummary: null,
        durationMs: 320,
        startedAt: new Date('2026-06-06T00:00:02.000Z'),
        agent: {
          name: '客服助手',
        },
      },
      {
        id: 'plugin-log-2',
        toolCode: 'query_db',
        status: PluginInvocationStatus.FAILED,
        errorSummary: '连接超时',
        durationMs: 1200,
        startedAt: new Date('2026-06-06T00:00:01.000Z'),
        agent: null,
      },
    ]);
    prisma.workflowRunNode.findMany.mockResolvedValue([
      {
        id: 'node-log-1',
        nodeId: 'classify',
        nodeType: 'llm',
        status: WorkflowRunNodeStatus.SUCCEEDED,
        errorMessage: null,
        durationMs: 800,
        startedAt: new Date('2026-06-06T00:00:03.000Z'),
        createdAt: new Date('2026-06-06T00:00:03.000Z'),
        run: {
          agent: {
            name: '客服助手',
          },
          workflow: {
            name: '订单回访',
          },
        },
      },
    ]);

    const result = await service.getSummary('user-id', 'workspace-id');

    expect(result).toMatchObject({
      agentCount: 2,
      conversationCount: 3,
      workflowCount: 4,
      pluginCount: 5,
      pluginEnabledCount: 3,
      knowledgeBaseCount: 2,
      knowledgeSyncedCount: 1,
      publishPendingCount: 1,
      pluginUpdateCount: 0,
      memberCount: 6,
      recentAgents: [
        {
          id: 'agent-1',
          description: '自动处理客户问题',
          status: 'published',
        },
        {
          id: 'agent-2',
          status: 'draft',
        },
      ],
      recentConversations: [
        {
          id: 'conversation-1',
          agent: {
            id: 'agent-1',
            name: '客服助手',
          },
        },
      ],
      recentWorkflows: [
        {
          id: 'run-1',
          workflowId: 'workflow-1',
          workflowName: '订单回访',
          status: 'success',
          duration: 12000,
        },
      ],
      recentLogs: [
        {
          id: 'node-log-1',
          type: 'workflow_step',
          agentName: '客服助手',
          status: 'success',
        },
        {
          id: 'plugin-log-1',
          type: 'tool_call',
          agentName: '客服助手',
          status: 'success',
        },
        {
          id: 'plugin-log-2',
          type: 'tool_call',
          agentName: '系统',
          status: 'failed',
        },
      ],
    });
    expect(
      new Date(result.recentLogs[0].timestamp).getTime(),
    ).toBeGreaterThanOrEqual(
      new Date(result.recentLogs[1].timestamp).getTime(),
    );
  });
});
