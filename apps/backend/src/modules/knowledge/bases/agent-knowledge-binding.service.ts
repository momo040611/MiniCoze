import { HttpStatus, Injectable } from '@nestjs/common';
import { KnowledgeBaseStatus, type Agent, type Prisma } from '@prisma/client';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../../common/utils/date-time';
import { PrismaService } from '../../../database/prisma.service';
import type {
  RuntimeKnowledgeBinding,
  RuntimeKnowledgeBindingConfig,
} from '../../../shared/types/agent';
import { WorkspaceAccessService } from '../../workspace/workspace-access.service';
import { ReplaceAgentKnowledgeBindingsDto } from './dto/replace-agent-knowledge-bindings.dto';
import { UpdateAgentKnowledgeBindingDto } from './dto/update-agent-knowledge-binding.dto';
import { AgentKnowledgeBindingResponse } from './types/agent-knowledge-binding-response.type';

type BindingWithKnowledgeBase = Prisma.KnowledgeBaseAgentBindingGetPayload<{
  include: { knowledgeBase: true };
}>;

type BindingWithKnowledgeBaseAndAgent =
  Prisma.KnowledgeBaseAgentBindingGetPayload<{
    include: { knowledgeBase: true; agent: true };
  }>;

@Injectable()
export class AgentKnowledgeBindingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async listForAgent(
    userId: string,
    agentId: string,
  ): Promise<AgentKnowledgeBindingResponse[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);

    const bindings = await this.prisma.knowledgeBaseAgentBinding.findMany({
      where: { agentId },
      include: { knowledgeBase: true },
      orderBy: { createdAt: 'asc' },
    });

    return bindings.map((binding) => this.toBindingResponse(binding));
  }

  async replaceForAgent(
    userId: string,
    agentId: string,
    dto: ReplaceAgentKnowledgeBindingsDto,
  ): Promise<AgentKnowledgeBindingResponse[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    await this.validateBindings(agent.workspaceId, dto.bindings);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.knowledgeBaseAgentBinding.deleteMany({
        where: { agentId },
      });

      if (!dto.bindings.length) {
        return;
      }

      await tx.knowledgeBaseAgentBinding.createMany({
        data: dto.bindings.map((binding) => ({
          agentId,
          knowledgeBaseId: binding.knowledgeBaseId,
          enabled: binding.enabled ?? true,
          config: binding.config
            ? (binding.config as Prisma.InputJsonValue)
            : undefined,
        })),
      });
    });

    return this.listForAgent(userId, agentId);
  }

  async updateBinding(
    userId: string,
    agentId: string,
    bindingId: string,
    dto: UpdateAgentKnowledgeBindingDto,
  ): Promise<AgentKnowledgeBindingResponse> {
    const binding = await this.findBindingOrThrow(agentId, bindingId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      binding.agent.workspaceId,
    );

    const nextEnabled = dto.enabled ?? binding.enabled;
    if (
      nextEnabled &&
      binding.knowledgeBase.status !== KnowledgeBaseStatus.ACTIVE
    ) {
      throw new BusinessException(
        `知识库不可启用到 Agent: ${binding.knowledgeBase.name}`,
        ErrorCode.KnowledgeBaseInvalidStatus,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.knowledgeBaseAgentBinding.update({
      where: { id: bindingId },
      include: { knowledgeBase: true },
      data: {
        enabled: dto.enabled,
        config: dto.config ? (dto.config as Prisma.InputJsonValue) : undefined,
      },
    });

    return this.toBindingResponse(updated);
  }

  async listRuntimeBindings(input: {
    userId: string;
    agentId: string;
    workspaceId: string;
  }): Promise<RuntimeKnowledgeBinding[]> {
    await this.workspaceAccessService.ensureMember(
      input.userId,
      input.workspaceId,
    );

    const bindings = await this.prisma.knowledgeBaseAgentBinding.findMany({
      where: {
        agentId: input.agentId,
        enabled: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return bindings.map((binding) => ({
      bindingId: binding.id,
      knowledgeBaseId: binding.knowledgeBaseId,
      enabled: binding.enabled,
      config: this.getBindingConfig(binding.config),
    }));
  }

  private async validateBindings(
    workspaceId: string,
    bindings: ReplaceAgentKnowledgeBindingsDto['bindings'],
  ): Promise<void> {
    const knowledgeBaseIds = Array.from(
      new Set(bindings.map((binding) => binding.knowledgeBaseId)),
    );

    if (!knowledgeBaseIds.length) {
      return;
    }

    const knowledgeBases = await this.prisma.knowledgeBase.findMany({
      where: {
        id: { in: knowledgeBaseIds },
        workspaceId,
      },
    });

    if (knowledgeBases.length !== knowledgeBaseIds.length) {
      throw new BusinessException(
        '存在不属于当前工作空间的知识库',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const knowledgeBaseMap = new Map(
      knowledgeBases.map((knowledgeBase) => [knowledgeBase.id, knowledgeBase]),
    );

    for (const binding of bindings) {
      const knowledgeBase = knowledgeBaseMap.get(binding.knowledgeBaseId);
      if (!knowledgeBase) {
        continue;
      }

      if (
        (binding.enabled ?? true) &&
        knowledgeBase.status !== KnowledgeBaseStatus.ACTIVE
      ) {
        throw new BusinessException(
          `知识库不可启用到 Agent: ${knowledgeBase.name}`,
          ErrorCode.KnowledgeBaseInvalidStatus,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private getBindingConfig(
    value: unknown,
  ): RuntimeKnowledgeBindingConfig | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value;
  }

  private async findAgentOrThrow(agentId: string): Promise<Agent> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
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

  private async findBindingOrThrow(
    agentId: string,
    bindingId: string,
  ): Promise<BindingWithKnowledgeBaseAndAgent> {
    const binding = await this.prisma.knowledgeBaseAgentBinding.findFirst({
      where: {
        id: bindingId,
        agentId,
      },
      include: {
        knowledgeBase: true,
        agent: true,
      },
    });

    if (!binding) {
      throw new BusinessException(
        'Agent 知识库绑定不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return binding;
  }

  private toBindingResponse(
    binding: BindingWithKnowledgeBase,
  ): AgentKnowledgeBindingResponse {
    return {
      bindingId: binding.id,
      agentId: binding.agentId,
      knowledgeBaseId: binding.knowledgeBaseId,
      name: binding.knowledgeBase.name,
      enabled: binding.enabled,
      config: this.getBindingConfig(binding.config),
      createdAt: formatShanghaiDateTime(binding.createdAt),
      updatedAt: formatShanghaiDateTime(binding.updatedAt),
    };
  }
}
