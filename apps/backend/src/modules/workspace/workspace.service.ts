import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Workspace, WorkspaceRole } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceQueryDto } from './dto/workspace-query.dto';
import { WorkspaceResponse } from './types/workspace-response.type';
import { WorkspaceAccessService } from './workspace-access.service';
import type { DashboardSummary } from './types/dashboard-summary.type';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async create(
    userId: string,
    createWorkspaceDto: CreateWorkspaceDto,
  ): Promise<WorkspaceResponse> {
    const workspace = await this.prisma.$transaction(async (tx) => {
      const createdWorkspace = await tx.workspace.create({
        data: {
          name: createWorkspaceDto.name,
          description: createWorkspaceDto.description,
          ownerId: userId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: createdWorkspace.id,
          userId,
          role: WorkspaceRole.OWNER,
        },
      });

      return createdWorkspace;
    });

    return this.toWorkspaceResponse(workspace, WorkspaceRole.OWNER);
  }

  async findMyWorkspaces(userId: string, query: WorkspaceQueryDto) {
    const { page, pageSize } = query;
    const where: Prisma.WorkspaceWhereInput = {
      members: {
        some: {
          userId,
        },
      },
    };

    const [workspaces, total] = await this.prisma.$transaction([
      this.prisma.workspace.findMany({
        where,
        include: {
          members: {
            where: {
              userId,
            },
            select: {
              role: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workspace.count({ where }),
    ]);

    return createPaginatedData({
      list: workspaces.map((workspace) =>
        this.toWorkspaceResponse(
          workspace,
          workspace.members[0]?.role ?? WorkspaceRole.MEMBER,
        ),
      ),
      total,
      page,
      pageSize,
    });
  }

  async findOneForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceResponse> {
    const member = await this.workspaceAccessService.ensureMember(
      userId,
      workspaceId,
    );
    const workspace = await this.findWorkspaceOrThrow(workspaceId);

    return this.toWorkspaceResponse(workspace, member.role);
  }

  async update(
    userId: string,
    workspaceId: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponse> {
    const member = await this.workspaceAccessService.ensureCanManage(
      userId,
      workspaceId,
    );

    const workspace = await this.prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: updateWorkspaceDto,
    });

    return this.toWorkspaceResponse(workspace, member.role);
  }

  async remove(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceResponse> {
    const member = await this.workspaceAccessService.ensureOwner(
      userId,
      workspaceId,
    );

    const workspace = await this.prisma.workspace.delete({
      where: {
        id: workspaceId,
      },
    });

    return this.toWorkspaceResponse(workspace, member.role);
  }

  private async findWorkspaceOrThrow(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new BusinessException(
        '工作空间不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return workspace;
  }

  async getDashboardSummary(
    userId: string,
    workspaceId: string,
  ): Promise<DashboardSummary> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const [
      agentCount,
      conversationCount,
      workflowCount,
      memberCount,
      recentAgents,
      recentConversations,
      publishPendingCount,
      recentWorkflowRuns,
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
      // 工作流数量
      this.prisma.workflow.count({
        where: { workspaceId },
      }),
      // 成员数量
      this.prisma.workspaceMember.count({
        where: { workspaceId },
      }),
      this.prisma.agent.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
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
        take: 5,
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
      // 发布待处理数量：状态为 DRAFT 的智能体数
      this.prisma.agent.count({
        where: {
          workspaceId,
          status: 'DRAFT',
        },
      }),
      // 最近的工作流运行记录
      this.prisma.workflowRun.findMany({
        where: { workspaceId },
        orderBy: { startedAt: 'desc' },
        take: 5,
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
    ]);

    // 工作流运行状态映射
    const mapWorkflowStatus = (
      status: string,
    ): 'running' | 'success' | 'failed' => {
      switch (status) {
        case 'SUCCEEDED':
          return 'success';
        case 'FAILED':
        case 'CANCELED':
          return 'failed';
        default:
          return 'running';
      }
    };

    return {
      agentCount,
      conversationCount,
      workflowCount,
      // 以下字段依赖 Plugin/KnowledgeBase 表，当前 schema 暂无，返回 0
      pluginCount: 0,
      knowledgeBaseCount: 0,
      publishPendingCount,
      pluginEnabledCount: 0,
      pluginUpdateCount: 0,
      memberCount,
      recentAgents: recentAgents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description ?? undefined,
        avatarUrl: a.avatarUrl,
        status: a.status,
        updatedAt: formatShanghaiDateTime(a.updatedAt),
      })),
      recentConversations: recentConversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: formatShanghaiDateTime(c.updatedAt),
        agent: c.agent
          ? { id: c.agent.id, name: c.agent.name }
          : { id: '', name: '未知' },
      })),
      recentWorkflows: recentWorkflowRuns.map((run) => ({
        id: run.id,
        workflowId: run.workflowId,
        workflowName: run.workflow.name,
        status: mapWorkflowStatus(run.status),
        startedAt: formatShanghaiDateTime(run.startedAt),
        duration: run.endedAt
          ? run.endedAt.getTime() - run.startedAt.getTime()
          : undefined,
      })),
      // 运行日志：基于最近的工作流节点执行记录生成
      recentLogs: [],
    };
  }

  private toWorkspaceResponse(
    workspace: Workspace,
    role: WorkspaceRole,
  ): WorkspaceResponse {
    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      ownerId: workspace.ownerId,
      role,
      createdAt: formatShanghaiDateTime(workspace.createdAt),
      updatedAt: formatShanghaiDateTime(workspace.updatedAt),
    };
  }
}
