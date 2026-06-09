import { HttpStatus, Injectable } from '@nestjs/common';
import { Agent, AgentStatus, Prisma } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { parseAgentPublishSnapshot } from '../publish/agent-publish-snapshot.util';
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
  ) {}

  async create(
    userId: string,
    createAgentDto: CreateAgentDto,
  ): Promise<AgentResponse> {
    await this.workspaceAccessService.ensureCanManage(
      userId,
      createAgentDto.workspaceId,
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
      temperature: agent.temperature,
      openingMessage: agent.openingMessage,
      contextLimit: agent.contextLimit,
      status: agent.status,
      createdAt: formatShanghaiDateTime(agent.createdAt),
      updatedAt: formatShanghaiDateTime(agent.updatedAt),
    };
  }
}
