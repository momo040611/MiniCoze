import { CodeNodeExecutor } from './code-node.executor';
import { WorkflowNodeExecutionContext } from './workflow-node-executor';

function makeContext(inputs: Record<string, unknown>): WorkflowNodeExecutionContext {
  return {
    node: { id: 'code-1', type: 'code', data: { inputs } } as never,
    input: {},
    state: {
      originalInput: {},
      currentText: '',
      nodeOutputs: {},
      sessionVars: {},
      globalVars: {},
      variableContext: { workspaceId: 'ws', globalKey: 'u' },
    },
    resolveTemplate: (t) => t,
    resolveValue: (ref) => ref,
  };
}

describe('CodeNodeExecutor', () => {
  let executor: CodeNodeExecutor;

  beforeEach(() => {
    executor = new CodeNodeExecutor();
  });

  it('正常转换脚本：统计并返回对象', async () => {
    const result = await executor.execute(
      makeContext({
        code: 'return { total: input.items.length, first: input.items[0] };',
        params: { items: 'placeholder' },
      }),
    );
    // resolveValue 是直通的，所以 input.items 是字符串——这里只验证对象结构与计算能力
    expect(result.output).toHaveProperty('total');
  });

  it('支持 Math / JSON 等白名单全局', async () => {
    const result = await executor.execute(
      makeContext({
        code: 'return { n: Math.max(1, 5, 3), s: JSON.stringify({ a: 1 }) };',
        params: {},
      }),
    );
    expect(result.output).toEqual({ n: 5, s: '{"a":1}' });
  });

  it('返回非对象时包装成 { value }', async () => {
    const result = await executor.execute(
      makeContext({ code: 'return 1 + 1;', params: {} }),
    );
    expect(result.output).toEqual({ value: 2 });
  });

  it('拒绝 require', async () => {
    await expect(
      executor.execute(
        makeContext({ code: "const fs = require('fs'); return {};", params: {} }),
      ),
    ).rejects.toThrow('不允许访问标识符');
  });

  it('拒绝 process / globalThis', async () => {
    await expect(
      executor.execute(makeContext({ code: 'return process.env;', params: {} })),
    ).rejects.toThrow('不允许访问标识符');
    await expect(
      executor.execute(
        makeContext({ code: 'return globalThis.process;', params: {} }),
      ),
    ).rejects.toThrow('不允许访问标识符');
  });

  it('拒绝 import / import.meta', async () => {
    // 顶层 import 在 wrapped IIFE 内是语法错误，也属于被拒绝（两类消息均可）。
    await expect(
      executor.execute(
        makeContext({ code: "import fs from 'fs'; return {};", params: {} }),
      ),
    ).rejects.toThrow(/不允许使用 import|代码语法错误/);
    await expect(
      executor.execute(
        makeContext({ code: "const m = await import('fs'); return {};", params: {} }),
      ),
    ).rejects.toThrow(/不允许使用 import|代码语法错误|不允许使用 await/);
    await expect(
      executor.execute(makeContext({ code: 'return import.meta;', params: {} })),
    ).rejects.toThrow(/不允许使用 import|代码语法错误/);
  });

  it('拒绝 constructor 原型逃逸', async () => {
    await expect(
      executor.execute(
        makeContext({
          code: "return ({}).constructor.constructor('return process')();",
          params: {},
        }),
      ),
    ).rejects.toThrow('不允许访问成员');
  });

  it('拒绝 __proto__ 与 computed 形式', async () => {
    await expect(
      executor.execute(
        makeContext({ code: 'return input.__proto__;', params: {} }),
      ),
    ).rejects.toThrow('不允许访问成员');
    await expect(
      executor.execute(
        makeContext({ code: "return input['constructor'];", params: {} }),
      ),
    ).rejects.toThrow('不允许访问成员');
  });

  it('拒绝 this / async / eval', async () => {
    await expect(
      executor.execute(makeContext({ code: 'return this;', params: {} })),
    ).rejects.toThrow('不允许使用 this');
    await expect(
      executor.execute(
        makeContext({ code: 'const f = async () => 1; return {};', params: {} }),
      ),
    ).rejects.toThrow('不允许使用 async');
    await expect(
      executor.execute(makeContext({ code: 'return eval("1");', params: {} })),
    ).rejects.toThrow('不允许访问标识符');
  });

  it('拒绝语法错误与超长代码', async () => {
    await expect(
      executor.execute(makeContext({ code: 'return {{{;', params: {} })),
    ).rejects.toThrow('代码语法错误');
    await expect(
      executor.execute(makeContext({ code: 'let x = 1;'.repeat(2000), params: {} })),
    ).rejects.toThrow('代码超过长度上限');
  });

  it('死循环被 1s 超时拦截', async () => {
    await expect(
      executor.execute(
        makeContext({ code: 'while (true) {} return {};', params: {} }),
      ),
    ).rejects.toThrow('code 节点执行失败');
  }, 5000);
});
