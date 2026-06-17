import { Injectable } from '@nestjs/common';
import type { Agent } from '@prisma/client';
import {
  AgentConfig,
  RunAgentCommand,
  ToolDefinition,
} from '../../../shared/types/agent';
import { AgentKnowledgeBindingService } from '../../knowledge/bases/agent-knowledge-binding.service';
import { PluginRegistryService } from '../../plugins/plugin-registry.service';
import { AgentService } from '../../single-agent/agent.service';
import { WorkflowToolRegistryService } from '../../workflow/workflow-tool-registry.service';

const DEFAULT_MAX_TOKENS = 4096;

@Injectable()
export class AgentConfigFactory {
  constructor(
    private readonly agentService: AgentService,
    private readonly pluginRegistryService: PluginRegistryService,
    private readonly workflowToolRegistryService: WorkflowToolRegistryService,
    private readonly agentKnowledgeBindingService: AgentKnowledgeBindingService,
  ) {}

  async build(command: RunAgentCommand): Promise<AgentConfig> {
    if (command.publishedSnapshot) {
      const snapshotAgent = command.publishedSnapshot.agent;

      // 发布运行优先使用快照里的 workspaceModelId，保证发布版本可复现。
      return {
        id: snapshotAgent.id,
        workspaceId: snapshotAgent.workspaceId,
        name: snapshotAgent.name,
        systemPrompt: snapshotAgent.systemPrompt,
        model: snapshotAgent.model,
        workspaceModelId:
          command.workspaceModelId ?? snapshotAgent.workspaceModelId ?? null,
        temperature: snapshotAgent.temperature,
        maxTokens: command.maxTokens ?? DEFAULT_MAX_TOKENS,
        contextLimit: snapshotAgent.contextLimit,
        tools: command.publishedSnapshot.tools ?? [],
        knowledgeBindings: command.publishedSnapshot.knowledgeBindings ?? [],
      };
    }

    const agent = command.preview
      ? await this.agentService.findPreviewAgentForUser(
          command.userId,
          command.agentId,
        )
      : await this.agentService.findRunnableAgentForUser(
          command.userId,
          command.agentId,
        );

    const tools =
      command.preview && command.tools?.length
        ? command.tools
        : await this.listRunnableTools(agent, command.userId);
    const knowledgeBindings =
      await this.agentKnowledgeBindingService.listRuntimeBindings({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        userId: command.userId,
      });

    return {
      id: agent.id,
      workspaceId: agent.workspaceId,
      name: agent.name,
      systemPrompt: command.systemPrompt ?? agent.systemPrompt,
      model: command.model ?? agent.model,
      // 预览运行允许请求体临时覆盖模型；未覆盖时使用 Agent 保存的模型引用。
      workspaceModelId: command.workspaceModelId ?? agent.workspaceModelId,
      temperature: command.temperature ?? agent.temperature,
      maxTokens: command.maxTokens ?? DEFAULT_MAX_TOKENS,
      contextLimit: agent.contextLimit,
      tools,
      knowledgeBindings,
    };
  }

  private async listRunnableTools(
    agent: Agent,
    userId: string,
  ): Promise<ToolDefinition[]> {
    const [pluginTools, workflowTools] = await Promise.all([
      this.pluginRegistryService.listRunnableTools({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        userId,
      }),
      this.workflowToolRegistryService.listRunnableTools({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        userId,
      }),
    ]);

    return [...pluginTools, ...workflowTools];
  }
}
