import { Injectable } from '@nestjs/common';
import { AgentConfig, RunAgentCommand } from '../../../shared/types/agent';
import { AgentService } from '../../single-agent/agent.service';

const DEFAULT_MAX_TOKENS = 4096;

@Injectable()
export class AgentConfigFactory {
  constructor(private readonly agentService: AgentService) {}

  async build(command: RunAgentCommand): Promise<AgentConfig> {
    const agent = await this.agentService.findRunnableAgentForUser(
      command.userId,
      command.agentId,
    );

    return {
      id: agent.id,
      name: agent.name,
      systemPrompt: command.systemPrompt ?? agent.systemPrompt,
      model: command.model ?? agent.model,
      temperature: command.temperature ?? agent.temperature,
      maxTokens: command.maxTokens ?? DEFAULT_MAX_TOKENS,
      contextLimit: agent.contextLimit,
      tools: command.tools ?? [],
    };
  }
}
