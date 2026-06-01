import { Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { ToolDefinition } from '../../shared/types/agent';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { PluginService } from './plugin.service';
import { type AgentPluginBindingConfig } from './types/plugin.types';

@Injectable()
export class PluginRegistryService {
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

  async listRunnableTools(input: {
    agentId: string;
    workspaceId: string;
    userId: string;
  }): Promise<ToolDefinition[]> {
    await this.workspaceAccessService.ensureMember(
      input.userId,
      input.workspaceId,
    );
    await this.pluginService.ensureBuiltinPlugins(
      input.userId,
      input.workspaceId,
    );

    const bindings = await this.prisma.agentPluginBinding.findMany({
      where: {
        agentId: input.agentId,
        status: 'ACTIVE',
        plugin: {
          workspaceId: input.workspaceId,
          status: 'ACTIVE',
        },
      },
      include: {
        plugin: {
          include: {
            tools: {
              where: {
                status: 'ACTIVE',
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    const tools: ToolDefinition[] = [];

    for (const binding of bindings) {
      const bindingConfig = this.getBindingConfig(binding.config);
      const disabledTools = Array.isArray(bindingConfig?.disabledTools)
        ? bindingConfig.disabledTools
        : [];

      for (const tool of binding.plugin.tools ?? []) {
        if (disabledTools.includes(tool.code)) {
          continue;
        }

        tools.push({
          type: 'function',
          function: {
            name: `${binding.plugin.code}__${tool.code}`,
            description: tool.description,
            parameters: (tool.inputSchema ?? {}) as Prisma.InputJsonObject,
          },
        });
      }
    }

    return tools;
  }
}
