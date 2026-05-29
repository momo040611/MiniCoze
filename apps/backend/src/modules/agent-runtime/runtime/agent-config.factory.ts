import { Injectable } from '@nestjs/common';
import { AgentConfig, RunAgentCommand } from '../../../shared/types/agent';
import { PluginRegistryService } from '../../plugins/plugin-registry.service';
import { AgentService } from '../../single-agent/agent.service';

const DEFAULT_MAX_TOKENS = 1024;

@Injectable()
export class AgentConfigFactory {
  constructor(
    private readonly agentService: AgentService,
    private readonly pluginRegistryService: PluginRegistryService,
  ) {}

  async build(command: RunAgentCommand): Promise<AgentConfig> {
    const agent = await this.agentService.findRunnableAgentForUser(
      command.userId,
      command.agentId,
    );

    const tools =
      command.preview && command.tools?.length
        ? command.tools
        : await this.pluginRegistryService.listRunnableTools({
            agentId: agent.id,
            workspaceId: agent.workspaceId,
            userId: command.userId,
          });

    return {
      id: agent.id,
      name: agent.name,
      systemPrompt: command.systemPrompt ?? agent.systemPrompt,
      model: command.model ?? agent.model,
      temperature: command.temperature ?? agent.temperature,
      maxTokens: command.maxTokens ?? DEFAULT_MAX_TOKENS,
      contextLimit: agent.contextLimit,
      tools,
    };
  }
}
