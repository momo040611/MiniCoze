import { HttpStatus, Injectable } from '@nestjs/common';
import { type Agent, type Prisma } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { ReplaceAgentPluginBindingsDto } from './dto/replace-agent-plugin-bindings.dto';
import { UpdateAgentPluginBindingDto } from './dto/update-agent-plugin-binding.dto';
import { PluginService } from './plugin.service';
import {
  type AgentPluginBindingConfig,
  type AgentPluginBindingResponse,
} from './types/plugin.types';

type BindingWithPlugin = Prisma.AgentPluginBindingGetPayload<{
  include: { plugin: true };
}>;

type BindingWithPluginAndAgent = Prisma.AgentPluginBindingGetPayload<{
  include: { plugin: true; agent: true };
}>;

@Injectable()
export class AgentPluginBindingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly pluginService: PluginService,
  ) {}

  private getBindingConfig(value: unknown): AgentPluginBindingConfig | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value;
  }

  async listForAgent(
    userId: string,
    agentId: string,
  ): Promise<AgentPluginBindingResponse[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);
    await this.pluginService.ensureBuiltinPlugins(userId, agent.workspaceId);

    const bindings = await this.prisma.agentPluginBinding.findMany({
      where: {
        agentId,
      },
      include: {
        plugin: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    return bindings.map((binding) => this.toBindingResponse(binding));
  }

  async replaceForAgent(
    userId: string,
    agentId: string,
    dto: ReplaceAgentPluginBindingsDto,
  ): Promise<AgentPluginBindingResponse[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );
    await this.pluginService.ensureBuiltinPlugins(userId, agent.workspaceId);

    const pluginIds = Array.from(
      new Set(dto.bindings.map((binding) => binding.pluginId)),
    );

    if (pluginIds.length) {
      const plugins = await this.prisma.pluginDefinition.findMany({
        where: {
          id: { in: pluginIds },
          workspaceId: agent.workspaceId,
        },
      });

      if (plugins.length !== pluginIds.length) {
        throw new BusinessException(
          '存在不属于当前工作空间的插件',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }

      const pluginMap = new Map(
        plugins.map((plugin) => [plugin.id, plugin] as const),
      );
      for (const binding of dto.bindings) {
        const plugin = pluginMap.get(binding.pluginId);
        if (!plugin) {
          continue;
        }
        const wantsActiveBinding = (binding.status ?? 'ACTIVE') === 'ACTIVE';
        if (
          wantsActiveBinding &&
          (plugin.status !== 'ACTIVE' || plugin.invocationEnabled !== true)
        ) {
          throw new BusinessException(
            `插件不可绑定或不可调用: ${plugin.name}`,
            ErrorCode.BadRequest,
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.agentPluginBinding.deleteMany({
        where: {
          agentId,
        },
      });

      if (!dto.bindings.length) {
        return;
      }

      await tx.agentPluginBinding.createMany({
        data: dto.bindings.map((binding, index) => ({
          agentId,
          pluginId: binding.pluginId,
          status: binding.status ?? 'ACTIVE',
          autoInvoke: binding.autoInvoke ?? true,
          sortOrder: binding.sortOrder ?? index,
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
    dto: UpdateAgentPluginBindingDto,
  ): Promise<AgentPluginBindingResponse> {
    const binding = await this.findBindingOrThrow(agentId, bindingId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      binding.agent.workspaceId,
    );

    if ((dto.status ?? binding.status) === 'ACTIVE') {
      if (
        binding.plugin.status !== 'ACTIVE' ||
        binding.plugin.invocationEnabled !== true
      ) {
        throw new BusinessException(
          `插件不可绑定或不可调用: ${binding.plugin.name}`,
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updated = await this.prisma.agentPluginBinding.update({
      where: {
        id: bindingId,
      },
      include: {
        plugin: true,
      },
      data: {
        status: dto.status,
        autoInvoke: dto.autoInvoke,
        sortOrder: dto.sortOrder,
        config: dto.config ? (dto.config as Prisma.InputJsonValue) : undefined,
      },
    });

    return this.toBindingResponse(updated);
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
  ): Promise<BindingWithPluginAndAgent> {
    const binding = await this.prisma.agentPluginBinding.findFirst({
      where: {
        id: bindingId,
        agentId,
      },
      include: {
        plugin: true,
        agent: true,
      },
    });

    if (!binding) {
      throw new BusinessException(
        'Agent 插件绑定不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return binding;
  }

  private toBindingResponse(
    binding: BindingWithPlugin,
  ): AgentPluginBindingResponse {
    return {
      bindingId: binding.id,
      agentId: binding.agentId,
      pluginId: binding.pluginId,
      code: binding.plugin.code,
      name: binding.plugin.name,
      type: binding.plugin.type,
      status: binding.status,
      autoInvoke: Boolean(binding.autoInvoke),
      sortOrder: binding.sortOrder,
      config: this.getBindingConfig(binding.config),
      createdAt: formatShanghaiDateTime(binding.createdAt),
      updatedAt: formatShanghaiDateTime(binding.updatedAt),
    };
  }
}
