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
import { RUNTIME_REPOSITORY, TOOL_EXECUTOR } from './runtime.tokens';

// Runtime 只负责“一次运行”的生命周期编排：
// 创建 run、恢复历史、保存输入输出、转发事件、更新最终状态。
// 真正的模型推理循环和 tool-call 循环由执行策略负责。
@Injectable()
export class AgentRuntime {
  constructor(
    @Inject(RUNTIME_REPOSITORY)
    private readonly repository: RuntimeRepository,
    private readonly configFactory: AgentConfigFactory,
    @Inject(AGENT_EXECUTION_STRATEGY)
    private readonly executionStrategy: AgentExecutionStrategy,
    @Inject(TOOL_EXECUTOR)
    private readonly toolExecutor: ToolExecutor,
  ) {}

  async *run(command: RunAgentCommand): AsyncIterable<RuntimeEvent> {
    // 这里生成本次运行的最小上下文，后续循环逻辑交给执行策略。
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

    try {
      context.status = 'in_progress';
      await this.repository.updateRunStatus(runId, 'in_progress');
      yield { type: 'run.in_progress', runId };
      await this.repository.appendMessage(runId, input);

      // runtime 只组装初始消息列表，后续消息追加由执行策略处理。
      const messages = this.composeMessages(
        agentConfig.systemPrompt,
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
    history: ChatMessage[],
    input: ChatMessage,
  ): ChatMessage[] {
    // 固定 system/history/input 顺序，避免不同入口组装出不一致上下文。
    return [{ role: 'system', content: systemPrompt }, ...history, input];
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
