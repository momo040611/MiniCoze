import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as vm from 'node:vm';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

const CODE_TIMEOUT_MS = 1000;

// CodeNodeExecutor：执行一段用户自定义 JS，用于数据加工 / 汇总 / 转换。
// 典型场景：把 loop 的 results 统计成「正面X条/负面Y条」。
//
// 配置（data.inputs）：
// - code:   函数体字符串，内部用 return 返回一个对象作为节点输出。
//           可访问变量 input（= 解析后的 params）。
// - params: { 名称: "{{引用}}" }，会被解析成真实值，组成 input 传给代码。
//
// 安全说明：使用 Node 内置 vm + 超时做基础隔离，仅适合自用/原型；
// 若要对外开放执行不可信代码，应替换为 isolated-vm 等真正的沙箱。
@Injectable()
export class CodeNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'code';
  private readonly logger = new Logger(CodeNodeExecutor.name);

  execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const inputs = this.asRecord(this.asRecord(context.node.data).inputs);
    const code = this.readString(inputs.code, 'return {};');

    // 解析 params：每个引用解析成真实值，组成代码可访问的 input 对象。
    const params = this.asRecord(inputs.params);
    const resolvedInput: Record<string, unknown> = {};
    for (const [key, ref] of Object.entries(params)) {
      resolvedInput[key] = context.resolveValue(ref);
    }

    this.logger.debug(`[code] input(解析后)=${this.dump(resolvedInput)}`);

    const output = this.runCode(code, resolvedInput);
    this.logger.debug(`[code] output=${this.dump(output)}`);

    return Promise.resolve({ output });
  }

  // 在受限 vm 上下文中执行用户代码，带超时保护。
  private runCode(
    code: string,
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    // 把用户代码包进一个立即执行函数，让 return 生效。
    const wrapped = `(function () {\n${code}\n})()`;
    // 仅暴露 input 与一个安全的 console.log（输出被丢弃），不给 require/process。
    const sandbox: vm.Context = vm.createContext({
      input,
      console: { log: (): void => undefined },
    });

    let result: unknown;
    try {
      const script = new vm.Script(wrapped);
      result = script.runInContext(sandbox, { timeout: CODE_TIMEOUT_MS });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BusinessException(
        `code 节点执行失败: ${message}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 约定：代码必须返回对象；返回非对象时包成 { value }，避免下游拿不到结构化数据。
    if (this.isRecord(result)) {
      return result;
    }
    return { value: result ?? null };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (this.isRecord(value)) {
      return value;
    }
    return {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private readString(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return fallback;
  }

  private dump(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
