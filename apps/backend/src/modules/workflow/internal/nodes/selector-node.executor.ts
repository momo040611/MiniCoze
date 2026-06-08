import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

// 单个条件：left <op> right。
// left / right 支持 {{...}} 引用或字面量。
interface SelectorCondition {
  left: unknown;
  op: string;
  right?: unknown;
}

// 一个分支：命中其条件时走该分支的端口。
interface SelectorBranch {
  port: string;
  logic?: 'and' | 'or';
  conditions: SelectorCondition[];
}

// SelectorNodeExecutor：条件分支节点（相当于 if / switch）。
// 它本身不产生业务数据，只负责“决定下一步走哪个出口端口”。
// 配置形式（data.inputs）支持两种：
// 1) branches: [{ port, logic, conditions: [{left, op, right}] }], defaultPort
// 2) 简化版 conditions: [...]（全部满足走 "true" 端口，否则走 "false"）
@Injectable()
export class SelectorNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'selector';
  private readonly logger = new Logger(SelectorNodeExecutor.name);

  execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const inputs = this.asRecord(this.asRecord(context.node.data).inputs);
    const branches = this.readBranches(inputs);
    const defaultPort = this.readString(inputs.defaultPort, 'default');
    this.logger.debug(`[selector] inputs(原始)=${this.dump(inputs)}`);
    this.logger.debug(`[selector] branches(解析后)=${this.dump(branches)}`);
    this.logger.debug(`[selector] defaultPort=${defaultPort}`);

    for (const branch of branches) {
      if (this.evaluateBranch(branch, context)) {
        this.logger.debug(`[selector] 命中分支 -> 端口=${branch.port}`);
        return Promise.resolve({
          output: { matched: true, port: branch.port },
          nextPort: branch.port,
        });
      }
    }

    // 没有任何分支命中，走默认/否定出口。
    this.logger.debug(`[selector] 无分支命中 -> 走默认端口=${defaultPort}`);
    return Promise.resolve({
      output: { matched: false, port: defaultPort },
      nextPort: defaultPort,
    });
  }

  // 解析分支配置，统一成 SelectorBranch[]。
  private readBranches(inputs: Record<string, unknown>): SelectorBranch[] {
    if (Array.isArray(inputs.branches)) {
      return inputs.branches
        .map((raw) => this.normalizeBranch(raw))
        .filter((branch): branch is SelectorBranch => branch !== null);
    }

    // 简化版：顶层 conditions 视为一个 "true" 分支。
    if (Array.isArray(inputs.conditions)) {
      return [
        {
          port: 'true',
          logic: 'and',
          conditions: inputs.conditions
            .map((raw) => this.normalizeCondition(raw))
            .filter((c): c is SelectorCondition => c !== null),
        },
      ];
    }

    return [];
  }

  private normalizeBranch(raw: unknown): SelectorBranch | null {
    if (!this.isRecord(raw)) {
      return null;
    }
    const port = this.readString(raw.port, '');
    if (!port) {
      return null;
    }
    const conditions = Array.isArray(raw.conditions)
      ? raw.conditions
          .map((c) => this.normalizeCondition(c))
          .filter((c): c is SelectorCondition => c !== null)
      : [];
    const logic = raw.logic === 'or' ? 'or' : 'and';
    return { port, logic, conditions };
  }

  private normalizeCondition(raw: unknown): SelectorCondition | null {
    if (!this.isRecord(raw)) {
      return null;
    }
    if (typeof raw.op !== 'string') {
      return null;
    }
    return { left: raw.left, op: raw.op, right: raw.right };
  }

  // 评估一个分支是否命中（按 and/or 组合其条件）。
  private evaluateBranch(
    branch: SelectorBranch,
    context: WorkflowNodeExecutionContext,
  ): boolean {
    if (branch.conditions.length === 0) {
      return true;
    }
    const results = branch.conditions.map((condition) =>
      this.evaluateCondition(condition, context),
    );
    return branch.logic === 'or'
      ? results.some(Boolean)
      : results.every(Boolean);
  }

  private evaluateCondition(
    condition: SelectorCondition,
    context: WorkflowNodeExecutionContext,
  ): boolean {
    const left = context.resolveValue(condition.left);
    const right = context.resolveValue(condition.right);
    const result = this.compare(left, condition.op, right);
    this.logger.debug(
      `[selector] 条件判断 left=${this.dump(left)} ${condition.op} right=${this.dump(right)} => ${result}`,
    );
    return result;
  }
  //比较两个值的大小，返回boolean值
  //equals: 等于
  //notEquals: 不等于
  //contains: 包含
  //notContains: 不包含
  //gt: 大于
  //gte: 大于等于
  //lt: 小于
  //lte: 小于等于
  //empty: 空
  //notEmpty: 非空
  private compare(left: unknown, op: string, right: unknown): boolean {
    switch (op) {
      case 'equals':
      case 'eq':
        return this.toComparable(left) === this.toComparable(right);
      case 'notEquals':
      case 'ne':
        return this.toComparable(left) !== this.toComparable(right);
      case 'contains':
        return this.toStr(left).includes(this.toStr(right));
      case 'notContains':
        return !this.toStr(left).includes(this.toStr(right));
      case 'gt':
        return this.toNum(left) > this.toNum(right);
      case 'gte':
        return this.toNum(left) >= this.toNum(right);
      case 'lt':
        return this.toNum(left) < this.toNum(right);
      case 'lte':
        return this.toNum(left) <= this.toNum(right);
      case 'empty':
        return this.isEmpty(left);
      case 'notEmpty':
        return !this.isEmpty(left);
      default:
        return false;
    }
  }

  //判断值是否为空
  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string') {
      return value.trim().length === 0;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return false;
  }

  //将值转换为可比较的类型
  private toComparable(value: unknown): string | number | boolean | null {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }
    if (value === null || value === undefined) {
      return null;
    }
    return JSON.stringify(value);
  }

  //将值转换为字符串
  private toStr(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined) {
      return '';
    }
    return JSON.stringify(value);
  }

  //将值转换为数字
  private toNum(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  //将值转换为记录
  private asRecord(value: unknown): Record<string, unknown> {
    if (this.isRecord(value)) {
      return value;
    }
    return {};
  }

  //判断值是否为记录
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  //读取字符串
  private readString(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return fallback;
  }

  // 打印原始数据用于调试，序列化失败则降级为 String。
  private dump(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
