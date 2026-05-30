import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { ReplaceAgentPluginBindingsDto } from './dto/replace-agent-plugin-bindings.dto';
import { UpdateAgentPluginBindingDto } from './dto/update-agent-plugin-binding.dto';
import { PluginService } from './plugin.service';
import { type AgentPluginBindingResponse } from './types/plugin.types';

@Injectable()
export class AgentPluginBindingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly pluginService: PluginService,
  ) {}

  private get db(): PrismaService & Record<string, any> {
    return this.prisma as PrismaService & Record<string, any>;
  }

  async listForAgent(
    userId: string,
    agentId: string,
  ): Promise<AgentPluginBindingResponse[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);
    await this.pluginService.ensureBuiltinPlugins(userId, agent.workspaceId);

    const bindings = await this.db.agentPluginBinding.findMany({
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

    return bindings.map((binding: any) => this.toBindingResponse(binding));
  }

  async replaceForAgent(
    userId: string,
    agentId: string,
    dto: ReplaceAgentPluginBindingsDto,
  ): Promise<AgentPluginBindingResponse[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(userId, agent.workspaceId);
    await this.pluginService.ensureBuiltinPlugins(userId, agent.workspaceId);

    const pluginIds = Array.from(
      new Set(dto.bindings.map((binding) => binding.pluginId)),
    );

    if (pluginIds.length) {
      const plugins = await this.db.pluginDefinition.findMany({
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
        plugins.map((plugin: any) => [plugin.id, plugin]),
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

    await this.db.$transaction(async (tx: any) => {
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
          config: binding.config,
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

    const updated = await this.db.agentPluginBinding.update({
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
        config: (dto.config ?? undefined) as any,
      },
    });

    return this.toBindingResponse(updated);
  }

  private async findAgentOrThrow(agentId: string): Promise<any> {
    const agent = await this.db.agent.findUnique({
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
  ): Promise<any> {
    const binding = await this.db.agentPluginBinding.findFirst({
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

  private toBindingResponse(binding: any): AgentPluginBindingResponse {
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
      config: (binding.config ?? null) as Record<string, unknown> | null,
      createdAt: formatShanghaiDateTime(binding.createdAt),
      updatedAt: formatShanghaiDateTime(binding.updatedAt),
    };
  }
}
