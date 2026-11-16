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
import { ConversationMemoryService } from './conversation-memory.service';
import { RunControlService } from '../run-control.service';
import { RuntimeSettingsService } from './runtime-settings.service';
import {
  RunCanceledError,
  RunTimeoutError,
} from './run-lifecycle.errors';
import { RuntimeAttachmentService } from './runtime-attachment.service';
import { RuntimeKnowledgeService } from './runtime-knowledge.service';
import { RUNTIME_REPOSITORY, TOOL_EXECUTOR } from './runtime.tokens';

type AbortReason = 'canceled' | 'timeout';

// 设置读取失败时的兜底总时长。
const DEFAULT_MAX_RUN_DURATION_MS = 5 * 60 * 1000;

@Injectable()
export class AgentRuntime {
  constructor(
    @Inject(RUNTIME_REPOSITORY)
    private readonly repository: RuntimeRepository,
    private readonly configFactory: AgentConfigFactory,
    private readonly runtimeAttachmentService: RuntimeAttachmentService,
    private readonly runtimeKnowledgeService: RuntimeKnowledgeService,
    private readonly runControlService: RunControlService,
    private readonly runtimeSettingsService: RuntimeSettingsService,
    private readonly conversationMemoryService: ConversationMemoryService,
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
    // 读取工作区运行设置：工具轮次上限 + 运行总时长（此前只存不读）。
    const settings = await this.runtimeSettingsService
      .get(agentConfig.workspaceId)
      .catch(() => null);

    // 取消链路：统一注册到中控（POST /agent-runs/:runId/cancel 可触发）；
    // 调用方自带 signal（如 SSE 断连）时转发其 abort 到内部控制器。
    const controller = this.runControlService.register(runId, {
      userId: command.userId,
      workspaceId: agentConfig.workspaceId,
    });
    const signal = controller.signal;
    if (command.signal) {
      if (command.signal.aborted) {
        controller.abort(command.signal.reason);
      } else {
        command.signal.addEventListener(
          'abort',
          () => controller.abort(command.signal!.reason),
          { once: true },
        );
      }
    }

    // 运行总时长兜底：超时后 abort，循环边界与在途模型请求都会被中断。
    const timeoutTimer = setTimeout(() => {
      if (!signal.aborted) {
        controller.abort('timeout' satisfies AbortReason);
      }
    }, settings?.maxRunDurationMs ?? DEFAULT_MAX_RUN_DURATION_MS);

    const context: RuntimeContext = {
      runId,
      conversationId,
      agentId: command.agentId,
      userId: command.userId,
      publicAccess: command.publicAccess,
      status: 'created',
      isPreview: command.preview ?? false,
      input,
      attachments: command.attachments,
      history: [],
      agentConfig,
      toolCallCount: 0,
    };

    try {
      await this.repository.saveRun(context, {
        source: command.source ?? (command.publicAccess ? 'PUBLIC' : 'CHAT'),
        model: agentConfig.model,
      });
      // 长期记忆：历史超过 contextLimit 时把截断部分增量摘要，
      // 以 system 消息注入「历史摘要」；未超出则全量注入。
      const memory = await this.conversationMemoryService.buildMemory(
        context,
        agentConfig.contextLimit,
      );
      context.history = memory.recentMessages;
      yield { type: 'run.created', runId, conversationId };

      context.status = 'in_progress';
      await this.repository.updateRunStatus(runId, 'in_progress');
      yield { type: 'run.in_progress', runId };
      await this.repository.appendMessage(runId, input);

      // 知识库检索：bound 状态与召回条数来自真实检索结果，
      // knowledge.status 在检索完成后发出，供前端展示知识库名与召回数。
      const knowledgeResult =
        await this.runtimeKnowledgeService.buildKnowledgeSystemMessage({
          context,
          query: command.message,
        });
      const knowledgeSummary = knowledgeResult.summary;
      if (!knowledgeSummary.bound) {
        yield {
          type: 'knowledge.status',
          runId,
          knowledge: { bound: false },
        };
      } else {
        yield {
          type: 'knowledge.status',
          runId,
          knowledge: {
            bound: true,
            knowledgeName: knowledgeSummary.bindings
              .map((b) => b.knowledgeBaseName ?? b.knowledgeBaseId)
              .join('、'),
            retrievedCount: knowledgeSummary.totalChunks,
          },
        };
      }

      const attachmentMessage =
        await this.runtimeAttachmentService.buildAttachmentSystemMessage({
          attachments: command.attachments,
          question: command.message,
          context,
        });
      const messages = this.composeMessages(
        agentConfig.systemPrompt,
        knowledgeResult.message,
        attachmentMessage,
        memory.memoryMessage,
        memory.recentMessages,
        input,
      );
      const generatedMessageStart = messages.length;

      let answer = '';
      const events = this.executionStrategy.stream({
        context,
        messages,
        toolExecutor: this.toolExecutor,
        signal,
        maxToolRounds: settings?.maxToolRounds,
      });

      for (;;) {
        if (signal?.aborted) {
          throw this.toAbortError(signal);
        }

        const next = await events.next();
        if (next.done) {
          answer = next.value;
          break;
        }

        // 统计工具调用次数，随 AgentRun 持久化。
        if (next.value.type === 'tool.call.created') {
          context.toolCallCount = (context.toolCallCount ?? 0) + 1;
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
      yield* this.handleRunFailure(runId, context, signal, error);
    } finally {
      clearTimeout(timeoutTimer);
      this.runControlService.release(runId);
      yield { type: 'stream.done', runId };
    }
  }

  /**
   * 统一处理失败/取消：区分「用户取消」「运行超时」「真实错误」三种终态，
   * 分别落库为 CANCELED / FAILED / FAILED，并发对应事件。
   */
  private async *handleRunFailure(
    runId: string,
    context: RuntimeContext,
    signal: AbortSignal | undefined,
    error: unknown,
  ): AsyncGenerator<RuntimeEvent, void, unknown> {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof RunCanceledError || signal?.aborted) {
      // 显式取消、模型请求抛出的 AbortError 等都归因到对应的取消/超时终态。
      return yield* this.abortFinalize(runId, context, signal!);
    }

    const isTimeout = error instanceof RunTimeoutError || /timed? ?out/i.test(message);

    context.status = 'failed';
    await this.repository.updateRunStatus(
      runId,
      'failed',
      undefined,
      isTimeout ? `运行超时：${message}` : message,
    );
    yield { type: 'run.failed', runId, error: message };
  }

  private async *abortFinalize(
    runId: string,
    context: RuntimeContext,
    signal: AbortSignal,
  ): AsyncGenerator<RuntimeEvent, void, unknown> {
    const reason = this.resolveAbortReason(signal);

    if (reason === 'timeout') {
      context.status = 'failed';
      await this.repository.updateRunStatus(
        runId,
        'failed',
        undefined,
        '运行超时：达到工作区 maxRunDurationMs 上限',
      );
      yield {
        type: 'run.failed',
        runId,
        error: '运行超时：达到工作区 maxRunDurationMs 上限',
      };
      return;
    }

    context.status = 'canceled';
    await this.repository.updateRunStatus(runId, 'canceled');
    yield { type: 'run.canceled', runId };
  }

  private toAbortError(signal: AbortSignal): Error {
    return this.resolveAbortReason(signal) === 'timeout'
      ? new RunTimeoutError('运行超时：达到工作区 maxRunDurationMs 上限')
      : new RunCanceledError();
  }

  private resolveAbortReason(signal: AbortSignal): AbortReason {
    // AbortSignal.reason 在 Node 18+ 可用；兜底按用户取消处理。
    return signal.reason === 'timeout' ? 'timeout' : 'canceled';
  }

  private composeMessages(
    systemPrompt: string,
    knowledgeMessage: ChatMessage | null,
    attachmentMessage: ChatMessage | null,
    memoryMessage: ChatMessage | null,
    history: ChatMessage[],
    input: ChatMessage,
  ): ChatMessage[] {
    return [
      { role: 'system', content: systemPrompt },
      ...(memoryMessage ? [memoryMessage] : []),
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
