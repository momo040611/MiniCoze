import { Injectable } from '@nestjs/common';
import { ToolDefinition } from '../../shared/types/agent';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { type AgentPluginBindingConfig } from './types/plugin.types';

@Injectable()
export class PluginRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private get db(): PrismaService & Record<string, any> {
    return this.prisma as PrismaService & Record<string, any>;
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

    const bindings = await this.db.agentPluginBinding.findMany({
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
      const bindingConfig = (binding.config ??
        null) as AgentPluginBindingConfig | null;
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
            parameters: (tool.inputSchema ?? {}) as Record<string, unknown>,
          },
        });
      }
    }

    return tools;
  }
}
