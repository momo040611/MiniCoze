import { Injectable } from '@nestjs/common';
import {
  RunAgentCommand,
  RuntimeAttachment,
  RuntimeEvent,
  RuntimeRunSource,
  ToolDefinition,
} from '../../shared/types/agent';
import type { AgentPublishSnapshot } from '../publish/types/publish.types';
import { AgentRunService } from './agent-run.service';
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
  // 运行来源：公开分享页为 PUBLIC，OpenAPI Key 调用为 API，用于运行记录统计。
  source?: RuntimeRunSource;
  snapshot: AgentPublishSnapshot;
}

@Injectable()
export class AgentRuntimeService {
  constructor(
    private readonly agentRuntime: AgentRuntime,
    private readonly agentRunService: AgentRunService,
  ) {}

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
      source: command.source ?? 'PUBLIC',
      publishedSnapshot: {
        agent: command.snapshot.agent,
        tools: this.getSnapshotTools(command.snapshot),
        knowledgeBindings: command.snapshot.knowledges ?? [],
      },
    });
  }

  /** 取消在途运行：归属校验在 AgentRunService 内完成。 */
  cancelRun(userId: string, runId: string): Promise<void> {
    return this.agentRunService.cancel(userId, runId);
  }

  listRuns(userId: string, query: Parameters<AgentRunService['list']>[1]) {
    return this.agentRunService.list(userId, query);
  }

  getRun(userId: string, runId: string) {
    return this.agentRunService.get(userId, runId);
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
