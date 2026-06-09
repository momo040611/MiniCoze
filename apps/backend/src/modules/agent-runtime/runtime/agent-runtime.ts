import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ChatMessage,
  RunAgentCommand,
  RuntimeEvent,
} from '../../../shared/types/agent';
import type {
  AgentExecutionStrategy,
  RuntimeContext,
  RuntimeRepository,
  ToolExecutor,
} from '../../../shared/types/runtime';
import { AGENT_EXECUTION_STRATEGY } from '../../../shared/tokens/runtime.tokens';
import { AgentConfigFactory } from './agent-config.factory';
import { RuntimeAttachmentService } from './runtime-attachment.service';
import { RuntimeKnowledgeService } from './runtime-knowledge.service';
import { RUNTIME_REPOSITORY, TOOL_EXECUTOR } from './runtime.tokens';

@Injectable()
export class AgentRuntime {
  constructor(
    @Inject(RUNTIME_REPOSITORY)
    private readonly repository: RuntimeRepository,
    private readonly configFactory: AgentConfigFactory,
    private readonly runtimeAttachmentService: RuntimeAttachmentService,
    private readonly runtimeKnowledgeService: RuntimeKnowledgeService,
    @Inject(AGENT_EXECUTION_STRATEGY)
    private readonly executionStrategy: AgentExecutionStrategy,
    @Inject(TOOL_EXECUTOR)
    private readonly toolExecutor: ToolExecutor,
  ) {}

  async *run(command: RunAgentCommand): AsyncIterable<RuntimeEvent> {
    const runId = randomUUID();
    const conversationId =
      command.conversationId ??
      `${command.publicAccess?.conversationIdPrefix ?? ''}${randomUUID()}`;
    const input: ChatMessage = {
      role: 'user',
      content: command.message,
    };

    const agentConfig = await this.configFactory.build(command);
    const context: RuntimeContext = {
      runId,
      conversationId,
      agentId: command.agentId,
      userId: command.userId,
      publicAccess: command.publicAccess,
      status: 'created',
      isPreview: command.preview ?? false,
      input,
      history: [],
      agentConfig,
    };

    await this.repository.saveRun(context);
    const history = await this.repository.getConversationHistory(
      conversationId,
      agentConfig.contextLimit,
    );
    context.history = history;
    yield { type: 'run.created', runId, conversationId };

    // 知识库状态检查
    if (command.knowledgeBaseId) {
      yield {
        type: 'knowledge.status',
        runId,
        knowledge: {
          bound: true,
          knowledgeName: '知识库',
          retrievedCount: undefined,
        },
      };
    } else {
      yield {
        type: 'knowledge.status',
        runId,
        knowledge: { bound: false },
      };
    }

    try {
      context.status = 'in_progress';
      await this.repository.updateRunStatus(runId, 'in_progress');
      yield { type: 'run.in_progress', runId };
      await this.repository.appendMessage(runId, input);

      const knowledgeMessage =
        await this.runtimeKnowledgeService.buildKnowledgeSystemMessage({
          context,
          query: command.message,
        });
      const attachmentMessage =
        await this.runtimeAttachmentService.buildAttachmentSystemMessage({
          attachments: command.attachments,
          question: command.message,
          context,
        });
      const messages = this.composeMessages(
        agentConfig.systemPrompt,
        knowledgeMessage,
        attachmentMessage,
        history,
        input,
      );
      const generatedMessageStart = messages.length;

      let answer = '';
      const events = this.executionStrategy.stream({
        context,
        messages,
        toolExecutor: this.toolExecutor,
      });

      for (;;) {
        const next = await events.next();
        if (next.done) {
          answer = next.value;
          break;
        }

        yield next.value;
      }

      await this.persistGeneratedMessages(
        runId,
        messages,
        generatedMessageStart,
      );
      await this.repository.appendMessage(runId, {
        role: 'assistant',
        content: answer,
      });
      context.status = 'completed';
      await this.repository.updateRunStatus(runId, 'completed', context.usage);
      yield { type: 'run.completed', runId, usage: context.usage };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.status = 'failed';
      await this.repository.updateRunStatus(
        runId,
        'failed',
        undefined,
        message,
      );
      yield { type: 'run.failed', runId, error: message };
    } finally {
      yield { type: 'stream.done', runId };
    }
  }

  private composeMessages(
    systemPrompt: string,
    knowledgeMessage: ChatMessage | null,
    attachmentMessage: ChatMessage | null,
    history: ChatMessage[],
    input: ChatMessage,
  ): ChatMessage[] {
    return [
      { role: 'system', content: systemPrompt },
      ...(knowledgeMessage ? [knowledgeMessage] : []),
      ...(attachmentMessage ? [attachmentMessage] : []),
      ...history,
      input,
    ];
  }

  private async persistGeneratedMessages(
    runId: string,
    messages: ChatMessage[],
    start: number,
  ): Promise<void> {
    for (const message of messages.slice(start)) {
      await this.repository.appendMessage(runId, message);
    }
  }
}
