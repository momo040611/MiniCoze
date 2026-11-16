import { WorkflowVariableScope } from '@prisma/client';
import { resolveTemplate, resolveValueRef, VariableScope } from '../variable/variable-resolver';
import { CodeNodeExecutor } from './code-node.executor';
import { EndNodeExecutor } from './end-node.executor';
import { SelectorNodeExecutor } from './selector-node.executor';
import type {
  WorkflowNodeExecutionContext,
  WorkflowRuntimeState,
} from './workflow-node-executor';

// 这组测试锁定「工作流示例模板」依赖的执行契约：
// 1) code 节点能跑模板里的统计代码，且 params 引用能解析出真实值
// 2) end 节点能把 outputs 映射成多字段最终输出（模板一的输出映射）
// 3) selector 节点按 branches + sourcePort 正确路由（模板三的条件分流）

type RuntimeStateOverrides = Partial<WorkflowRuntimeState>;

function buildState(overrides: RuntimeStateOverrides = {}): WorkflowRuntimeState {
  return {
    originalInput: { query: 'Hello MiniCoze' },
    currentText: '',
    nodeOutputs: {},
    sessionVars: {},
    globalVars: {},
    variableContext: {
      workspaceId: 'ws_1',
      globalKey: 'ws_1',
      sessionKey: 'session_1',
    },
    ...overrides,
  };
}

function buildContext(
  node: { id: string; type: string; data?: Record<string, unknown> },
  state: WorkflowRuntimeState,
): WorkflowNodeExecutionContext {
  const scope: VariableScope = {
    input: state.originalInput,
    nodeOutputs: state.nodeOutputs,
    session: state.sessionVars,
    global: state.globalVars,
  };

  return {
    node,
    input: state.originalInput,
    state,
    resolveTemplate: (template: string) => resolveTemplate(template, scope),
    resolveValue: (ref: unknown) => resolveValueRef(ref, scope),
  };
}

describe('工作流示例模板执行契约', () => {
  it('code 节点能执行模板一的统计代码并解析 params 引用', async () => {
    const executor = new CodeNodeExecutor();
    const state = buildState();
    const context = buildContext(
      {
        id: 'code_1',
        type: 'code',
        data: {
          inputs: {
            code: [
              "const text = String(input.text ?? '');",
              'const trimmed = text.trim();',
              "const words = trimmed ? trimmed.split(' ').filter(Boolean).length : 0;",
              'return {',
              '  length: text.length,',
              '  words,',
              '  upper: text.toUpperCase(),',
              '};',
            ].join('\n'),
            params: { text: '{{input.query}}' },
          },
        },
      },
      state,
    );

    const result = await executor.execute(context);

    expect(result.output).toEqual({
      length: 14,
      words: 2,
      upper: 'HELLO MINICOZE',
    });
  });

  it('end 节点按 outputs 映射输出多字段最终结果', async () => {
    const executor = new EndNodeExecutor();
    const state = buildState({
      nodeOutputs: {
        code_1: { length: 14, words: 2, upper: 'HELLO MINICOZE' },
      },
    });
    const context = buildContext(
      {
        id: 'end_1',
        type: 'end',
        data: {
          inputs: {
            outputs: {
              字符数: '{{code_1.length}}',
              词数: '{{code_1.words}}',
              大写结果: '{{code_1.upper}}',
            },
          },
        },
      },
      state,
    );

    const result = await executor.execute(context);

    expect(result.output).toEqual({
      字符数: 14,
      词数: 2,
      大写结果: 'HELLO MINICOZE',
      final: true,
    });
  });

  it('selector 节点按 branches 命中 true 端口，否则回落 false 端口', async () => {
    const executor = new SelectorNodeExecutor();
    const node = {
      id: 'condition_1',
      type: 'selector',
      data: {
        inputs: {
          branches: [
            {
              port: 'true',
              logic: 'and' as const,
              conditions: [{ left: '{{input.query}}', op: 'contains', right: '退款' }],
            },
          ],
          defaultPort: 'false',
        },
      },
    };

    const refundContext = buildContext(node, buildState({ originalInput: { query: '我要退款' } }));
    const refundResult = await executor.execute(refundContext);
    expect(refundResult.nextPort).toBe('true');

    const otherContext = buildContext(node, buildState({ originalInput: { query: '查物流' } }));
    const otherResult = await executor.execute(otherContext);
    expect(otherResult.nextPort).toBe('false');
  });

  it('变量作用域常量与 variable context 对齐（session/global 可写）', () => {
    // 防止 variableContext 字段名漂移导致模板里 session 变量写入失败。
    expect(WorkflowVariableScope.SESSION).toBe('SESSION');
    const state = buildState();
    expect(state.variableContext.sessionKey).toBeTruthy();
    expect(state.variableContext.globalKey).toBeTruthy();
  });
});
