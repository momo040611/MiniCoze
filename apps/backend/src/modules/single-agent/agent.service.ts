import { HttpStatus, Injectable } from '@nestjs/common';
import { Agent, AgentStatus, Prisma } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { parseAgentPublishSnapshot } from '../publish/agent-publish-snapshot.util';
import { WorkspaceModelService } from '../model-management/workspace-model.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { AgentQueryDto } from './dto/agent-query.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentResponse } from './types/agent-response.type';

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly workspaceModelService: WorkspaceModelService,
  ) {}

  async create(
    userId: string,
    createAgentDto: CreateAgentDto,
  ): Promise<AgentResponse> {
    await this.workspaceAccessService.ensureCanManage(
      userId,
      createAgentDto.workspaceId,
    );
    // 创建时没有传 workspaceModelId，则尝试绑定工作区默认模型；
    // 如果工作区还没配置模型，继续保留旧 model 字符串链路。
    const workspaceModelId = await this.resolveCreateWorkspaceModelId(
      createAgentDto.workspaceId,
      createAgentDto.workspaceModelId,
    );

    const agent = await this.prisma.agent.create({
      data: {
        workspaceId: createAgentDto.workspaceId,
        creatorId: userId,
        name: createAgentDto.name,
        description: createAgentDto.description,
        avatarUrl: createAgentDto.avatarUrl,
        systemPrompt: createAgentDto.systemPrompt,
        model: createAgentDto.model,
        workspaceModelId,
        temperature: createAgentDto.temperature,
        openingMessage: createAgentDto.openingMessage,
        contextLimit: createAgentDto.contextLimit,
      },
    });

    return this.toAgentResponse(agent);
  }

  async findByWorkspace(userId: string, query: AgentQueryDto) {
    await this.workspaceAccessService.ensureMember(userId, query.workspaceId);

    const { page, pageSize, workspaceId, status, keyword } = query;
    const where: Prisma.AgentWhereInput = {
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

    const [agents, total] = await this.prisma.$transaction([
      this.prisma.agent.findMany({
        where,
        orderBy: {
          updatedAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.agent.count({ where }),
    ]);

    return createPaginatedData({
      list: agents.map((agent) => this.toAgentResponse(agent)),
      total,
      page,
      pageSize,
    });
  }

  async findOneForUser(
    userId: string,
    agentId: string,
  ): Promise<AgentResponse> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);

    return this.toAgentResponse(agent);
  }

  async findRunnableAgentForUser(
    userId: string,
    agentId: string,
  ): Promise<Agent> {
    const agent = await this.prisma.agent.findUnique({
      where: {
        id: agentId,
      },
      include: {
        currentVersion: true,
      },
    });

    if (!agent) {
      throw new BusinessException(
        'Agent 不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);

    if (agent.status !== AgentStatus.ACTIVE || !agent.currentVersion) {
      throw new BusinessException(
        'Agent 尚未发布或已下线',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const snapshot = parseAgentPublishSnapshot(agent.currentVersion.snapshot);
    if (!snapshot) {
      throw new BusinessException(
        'Agent 发布快照无效',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      ...agent,
      name: snapshot.agent.name,
      description: snapshot.agent.description,
      avatarUrl: snapshot.agent.avatarUrl,
      systemPrompt: snapshot.agent.systemPrompt,
      model: snapshot.agent.model,
      workspaceModelId: snapshot.agent.workspaceModelId ?? null,
      temperature: snapshot.agent.temperature,
      openingMessage: snapshot.agent.openingMessage,
      contextLimit: snapshot.agent.contextLimit,
    };
  }

  async findPreviewAgentForUser(
    userId: string,
    agentId: string,
  ): Promise<Agent> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);
    return agent;
  }

  async update(
    userId: string,
    agentId: string,
    updateAgentDto: UpdateAgentDto,
  ): Promise<AgentResponse> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );
    if (updateAgentDto.workspaceModelId) {
      // 更新只在显式传入 workspaceModelId 时校验并覆盖，未传则保持现有引用。
      await this.workspaceModelService.ensureSelectableModel(
        agent.workspaceId,
        updateAgentDto.workspaceModelId,
      );
    }

    const updatedAgent = await this.prisma.agent.update({
      where: {
        id: agentId,
      },
      data: {
        name: updateAgentDto.name,
        description: updateAgentDto.description,
        avatarUrl: updateAgentDto.avatarUrl,
        systemPrompt: updateAgentDto.systemPrompt,
        model: updateAgentDto.model,
        workspaceModelId: updateAgentDto.workspaceModelId,
        temperature: updateAgentDto.temperature,
        openingMessage: updateAgentDto.openingMessage,
        contextLimit: updateAgentDto.contextLimit,
      },
    });

    return this.toAgentResponse(updatedAgent);
  }

  async remove(userId: string, agentId: string): Promise<AgentResponse> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    const deletedAgent = await this.prisma.agent.delete({
      where: {
        id: agentId,
      },
    });

    return this.toAgentResponse(deletedAgent);
  }

  private async findAgentOrThrow(agentId: string): Promise<Agent> {
    const agent = await this.prisma.agent.findUnique({
      where: {
        id: agentId,
      },
    });

    if (!agent) {
      throw new BusinessException(
        'Agent 不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return agent;
  }

  private toAgentResponse(agent: Agent): AgentResponse {
    return {
      id: agent.id,
      workspaceId: agent.workspaceId,
      creatorId: agent.creatorId,
      name: agent.name,
      description: agent.description,
      avatarUrl: agent.avatarUrl,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      workspaceModelId: agent.workspaceModelId,
      temperature: agent.temperature,
      openingMessage: agent.openingMessage,
      contextLimit: agent.contextLimit,
      status: agent.status,
      createdAt: formatShanghaiDateTime(agent.createdAt),
      updatedAt: formatShanghaiDateTime(agent.updatedAt),
    };
  }

  private async resolveCreateWorkspaceModelId(
    workspaceId: string,
    workspaceModelId?: string,
  ): Promise<string | undefined> {
    // 显式传入优先于默认模型，适用于后续前端设置页或 API 直接创建 Agent。
    if (workspaceModelId) {
      await this.workspaceModelService.ensureSelectableModel(
        workspaceId,
        workspaceModelId,
      );
      return workspaceModelId;
    }

    // 创建阶段未传 workspaceModelId 时，优先挂工作区默认模型；
    // 如果工作区还没有设置模块配置，则保持旧 model 字符串链路，不阻塞旧前端。
    const defaultModelId =
      await this.workspaceModelService.getDefaultModelId(workspaceId);
    return defaultModelId ?? undefined;
  }
}
