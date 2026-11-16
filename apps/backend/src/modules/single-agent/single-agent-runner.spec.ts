import { SingleAgentRunner } from './single-agent-runner';
import { RunCanceledError } from '../agent-runtime/runtime/run-lifecycle.errors';
import type { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { ModelResolverService } from '../model-management/model-resolver.service';
import type { AgentExecutionInput } from '../../shared/types/runtime';
import type { RuntimeContext } from '../../shared/types/runtime';

function buildContext(overrides: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    runId: 'run-1',
    conversationId: 'conv-1',
    agentId: 'agent-1',
    userId: 'user-1',
    status: 'in_progress',
    input: { role: 'user', content: 'hi' },
    history: [],
    agentConfig: {
      id: 'agent-1',
      workspaceId: 'ws-1',
      name: 'test',
      systemPrompt: 'p',
      model: 'gpt-test',
      temperature: 0.7,
      maxTokens: 1024,
      contextLimit: 20,
      tools: [],
    },
    ...overrides,
  };
}

function buildInput(
  overrides: Partial<AgentExecutionInput> = {},
): AgentExecutionInput {
  return {
    context: buildContext(),
    messages: [],
    toolExecutor: {
      execute: jest.fn().mockResolvedValue({
        toolCallId: 'call-1',
        output: 'tool-result',
        metadata: {},
      }),
    },
    ...overrides,
  };
}

function mockGatewayWithAlwaysToolCall(): AiGatewayService {
  const chunk = {
    content: '',
    toolCalls: [
      {
        id: 'call-1',
        type: 'function' as const,
        function: { name: 'plug__tool', arguments: '{}' },
      },
    ],
  };

  return {
    chatStream: jest.fn().mockImplementation(() => (async function* () {
      yield chunk;
    })()),
    chatStreamWithResolvedModel: jest.fn().mockImplementation(() => (async function* () {
      yield chunk;
    })()),
  } as unknown as AiGatewayService;
}

function mockModelResolver(): ModelResolverService {
  return {
    resolve: jest.fn().mockResolvedValue({
      providerType: 'OPENAI',
      modelId: 'gpt-test',
      baseUrl: 'https://example.com/v1',
      credential: { type: 'BEARER_TOKEN', secret: 'k' },
      source: 'legacy-env',
    }),
  } as unknown as ModelResolverService;
}

describe('SingleAgentRunner 工具轮次上限', () => {
  it('超过 maxToolRounds 后抛错终止，不再继续调用模型', async () => {
    const runner = new SingleAgentRunner(
      mockGatewayWithAlwaysToolCall(),
      mockModelResolver(),
    );

    const generator = runner.stream(buildInput({ maxToolRounds: 3 }));
    const events: unknown[] = [];

    await expect(async () => {
      for await (const event of generator) {
        events.push(event);
      }
    }).rejects.toThrow(/工具调用轮次已达上限/);

    // 3 轮 = 每轮 1 个 tool.call.created 事件
    const created = events.filter(
      (event) => (event as { type: string }).type === 'tool.call.created',
    );
    expect(created).toHaveLength(3);
  });

  it('模型不再返回 tool_calls 时正常结束，不受轮次限制影响', async () => {
    const gateway = {
      chatStream: jest.fn().mockImplementation(() => (async function* () {
        yield { content: 'hello', toolCalls: undefined };
      })()),
    } as unknown as AiGatewayService;

    const runner = new SingleAgentRunner(gateway, mockModelResolver());
    const generator = runner.stream(buildInput({ maxToolRounds: 3 }));
    let answer = '';
    for (;;) {
      const next = await generator.next();
      if (next.done) {
        answer = next.value;
        break;
      }
    }

    expect(answer).toBe('hello');
  });

  it('signal 已取消时在循环边界抛 RunCanceledError', async () => {
    const runner = new SingleAgentRunner(
      mockGatewayWithAlwaysToolCall(),
      mockModelResolver(),
    );

    const controller = new AbortController();
    controller.abort('canceled');

    await expect(async () => {
      for await (const _ of runner.stream(buildInput({ signal: controller.signal }))) {
        // 消费事件
      }
    }).rejects.toThrow(RunCanceledError);
  });
});
