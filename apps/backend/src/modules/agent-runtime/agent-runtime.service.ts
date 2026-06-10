import { Injectable } from '@nestjs/common';
import {
  RunAgentCommand,
  RuntimeAttachment,
  RuntimeEvent,
  ToolDefinition,
} from '../../shared/types/agent';
import type { AgentPublishSnapshot } from '../publish/types/publish.types';
import { AgentRuntime } from './runtime/agent-runtime';

export interface RunPublishedAgentCommand {
  agentId: string;
  userId: string;
  message: string;
  conversationId?: string;
  attachments?: RuntimeAttachment[];
  publicAccess: {
    conversationIdPrefix: string;
  };
  snapshot: AgentPublishSnapshot;
}

@Injectable()
export class AgentRuntimeService {
  constructor(private readonly agentRuntime: AgentRuntime) {}

  run(command: RunAgentCommand): AsyncIterable<RuntimeEvent> {
    return this.agentRuntime.run(command);
  }

  runPublishedSnapshot(
    command: RunPublishedAgentCommand,
  ): AsyncIterable<RuntimeEvent> {
    return this.agentRuntime.run({
      agentId: command.agentId,
      userId: command.userId,
      message: command.message,
      conversationId: command.conversationId,
      attachments: command.attachments,
      publicAccess: command.publicAccess,
      publishedSnapshot: {
        agent: command.snapshot.agent,
        tools: this.getSnapshotTools(command.snapshot),
        knowledgeBindings: command.snapshot.knowledges ?? [],
      },
    });
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }

  private getSnapshotTools(snapshot: AgentPublishSnapshot): ToolDefinition[] {
    return [
      ...snapshot.plugins.flatMap((plugin) => plugin.tools ?? []),
      ...snapshot.workflows.flatMap((workflow) =>
        workflow.tool ? [workflow.tool] : [],
      ),
    ];
  }
}
