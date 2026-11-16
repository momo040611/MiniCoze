import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as vm from 'node:vm';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

const CODE_TIMEOUT_MS = 1000;
const CODE_MAX_LENGTH = 10_000;

// CodeNodeExecutor：执行一段用户自定义 JS，用于数据加工 / 汇总 / 转换。
// 典型场景：把 loop 的 results 统计成「正面X条/负面Y条」。
//
// 配置（data.inputs）：
// - code:   函数体字符串，内部用 return 返回一个对象作为节点输出。
//           可访问变量 input（= 解析后的 params）。
// - params: { 名称: "{{引用}}" }，会被解析成真实值，组成 input 传给代码。
//
// 安全设计（双层）：
// 1. 静态层：acorn 解析 + AST 白名单校验——只允许纯 JS 子集，
//    禁止 require/process/globalThis/import/eval/this、
//    禁止 constructor/__proto__/prototype 等逃逸成员访问、禁止 async。
// 2. 执行层：node:vm 独立上下文 + 1s 超时（拦截死循环）。
//    通过校验的代码访问不到任何宿主能力；若未来要执行更复杂脚本，
//    再考虑替换为 isolated-vm（需原生编译）。
const ALLOWED_GLOBALS = new Set([
  // 基础类型与工具对象
  'Math',
  'JSON',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'Date',
  'RegExp',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'Symbol',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Intl',
  // 常用全局函数
  'isNaN',
  'isFinite',
  'parseInt',
  'parseFloat',
  'encodeURIComponent',
  'decodeURIComponent',
  'encodeURI',
  'decodeURI',
  'structuredClone',
  // 特殊值
  'undefined',
  'NaN',
  'Infinity',
  // 沙箱注入的变量
  'input',
  'console',
  'arguments',
]);

// 禁止作为成员访问的属性名（含 computed 形式 obj['x']）。
const FORBIDDEN_MEMBERS = new Set([
  'constructor',
  'prototype',
  '__proto__',
  'caller',
  'callee',
]);

@Injectable()
export class CodeNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'code';
  private readonly logger = new Logger(CodeNodeExecutor.name);

  async execute(
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

  // 静态校验：解析失败或命中黑名单一律拒绝执行。
  // 注意语法解析针对 wrapped（用户代码是函数体，顶层 return 在裸 script 中非法）。
  private validate(code: string, wrapped: string): void {
    if (code.length > CODE_MAX_LENGTH) {
      throw this.codeError(`代码超过长度上限（${CODE_MAX_LENGTH} 字符）`);
    }

    let ast: acorn.Node;
    try {
      ast = acorn.parse(wrapped, {
        ecmaVersion: 'latest',
        sourceType: 'script',
        allowAwaitOutsideFunction: false,
      });
    } catch (error) {
      throw this.codeError(
        `代码语法错误: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const declaredNames = this.collectDeclaredNames(ast);

    this.walkNode(ast as unknown as Record<string, unknown>, declaredNames);
  }

  // 手动递归遍历 AST（不依赖 acorn-walk 的 full，因为需要跳过
  // 对象字面量的 key、非计算成员属性、标签等"非引用"标识符位置）。
  private walkNode(node: unknown, declared: Set<string>): void {
    if (Array.isArray(node)) {
      for (const child of node) {
        this.walkNode(child, declared);
      }
      return;
    }
    if (
      !node ||
      typeof node !== 'object' ||
      typeof (node as Record<string, unknown>).type !== 'string'
    ) {
      return;
    }
    const n = node as Record<string, unknown>;
    this.checkNode(n, declared);

    for (const key of Object.keys(n)) {
      // 跳过元信息字段。
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') {
        continue;
      }
      // 非计算成员属性（a.b 的 b）不是引用，且已在 checkNode 中做黑名单校验。
      if (n.type === 'MemberExpression' && key === 'property' && n.computed !== true) {
        continue;
      }
      // 对象字面量/模式的 key（{ name: 1 } 的 name）不是引用。
      if (
        (n.type === 'Property' || n.type === 'PropertyPattern' || n.type === 'MethodDefinition') &&
        key === 'key' &&
        n.computed !== true
      ) {
        continue;
      }
      // 语句标签（outer: / break outer）不是变量引用。
      if (
        (n.type === 'LabeledStatement' ||
          n.type === 'BreakStatement' ||
          n.type === 'ContinueStatement') &&
        key === 'label'
      ) {
        continue;
      }
      this.walkNode(n[key], declared);
    }
  }

  // 收集用户自己声明的名字（变量/函数/参数等），这些标识符放行。
  private collectDeclaredNames(ast: acorn.Node): Set<string> {
    const names = new Set<string>();

    walk.full(ast, (node) => {
      const n = node as unknown as Record<string, unknown>;
      switch (n.type) {
        case 'VariableDeclarator':
          this.addPatternName(n.id, names);
          break;
        case 'FunctionDeclaration':
        case 'ClassDeclaration':
          if (typeof n.id === 'object' && n.id !== null && 'name' in n.id) {
            names.add((n.id as { name: string }).name);
          }
          break;
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
          for (const p of (n.params ?? []) as acorn.Node[]) {
            this.addPatternName(p, names);
          }
          break;
        case 'CatchClause':
          if (n.param) {
            this.addPatternName(n.param, names);
          }
          break;
        case 'ForInStatement':
        case 'ForOfStatement':
          this.addPatternName(n.left as acorn.Node, names);
          break;
        default:
          break;
      }
    });

    return names;
  }

  private addPatternName(pattern: unknown, names: Set<string>): void {
    if (!pattern || typeof pattern !== 'object') {
      return;
    }
    const node = pattern as Record<string, unknown>;
    switch (node.type) {
      case 'Identifier':
        names.add(node.name as string);
        break;
      case 'ObjectPattern':
        for (const prop of node.properties as Record<string, unknown>[]) {
          this.addPatternName(
            prop.type === 'RestElement' ? prop.argument : prop.value,
            names,
          );
        }
        break;
      case 'ArrayPattern':
        for (const el of node.elements as unknown[]) {
          this.addPatternName(el, names);
        }
        break;
      case 'RestElement':
        this.addPatternName(node.argument, names);
        break;
      case 'AssignmentPattern':
        this.addPatternName(node.left, names);
        break;
      default:
        break;
    }
  }

  private checkNode(n: Record<string, unknown>, declaredNames: Set<string>): void {
    switch (n.type) {
      // 动态代码 / 模块系统 / 原型逃逸入口，全部禁止。
      case 'WithStatement':
        throw this.codeError('不允许使用 with 语句');
      case 'DebuggerStatement':
        throw this.codeError('不允许使用 debugger');
      case 'ImportDeclaration':
      case 'ImportExpression':
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
      case 'MetaProperty': // import.meta / new.target
        throw this.codeError('不允许使用 import/export/import.meta');
      case 'ThisExpression':
        throw this.codeError('不允许使用 this');
      case 'YieldExpression':
        throw this.codeError('不允许使用 yield');
      case 'AwaitExpression':
        throw this.codeError('不允许使用 await');
      // 异步函数是 vm 逃逸的经典向量（AsyncFunction 构造器），直接禁止。
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (n.async === true) {
          throw this.codeError('不允许使用 async 函数');
        }
        break;
      case 'Identifier': {
        const name = n.name as string;
        if (!ALLOWED_GLOBALS.has(name) && !declaredNames.has(name)) {
          throw this.codeError(`不允许访问标识符 "${name}"`);
        }
        break;
      }
      case 'MemberExpression': {
        const prop = n.property as Record<string, unknown> | undefined;
        if (!prop) {
          break;
        }
        // 非计算属性：a.constructor
        if (prop.type === 'Identifier') {
          const name = prop.name as string;
          if (FORBIDDEN_MEMBERS.has(name)) {
            throw this.codeError(`不允许访问成员 "${name}"`);
          }
        }
        // 计算属性且是字面量：a['constructor']
        if (prop.type === 'Literal' && typeof prop.value === 'string') {
          if (FORBIDDEN_MEMBERS.has(prop.value)) {
            throw this.codeError(`不允许访问成员 "${prop.value}"`);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // 在受限 vm 上下文中执行用户代码，带超时保护。
  private runCode(
    code: string,
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    // 把用户代码包进一个立即执行函数，让 return 生效。
    const wrapped = `(function () {\n${code}\n})()`;

    this.validate(code, wrapped);

    // 仅暴露 input 与一个安全的 console.log（输出被丢弃），不给 require/process。
    const sandbox = Object.freeze({
      input,
      console: Object.freeze({ log: (): void => undefined }),
    });
    const context = vm.createContext(sandbox);

    let result: unknown;
    try {
      const script = new vm.Script(wrapped, {
        importModuleDynamically: (): never => {
          throw this.codeError('不允许动态 import');
        },
      });
      result = script.runInContext(context, { timeout: CODE_TIMEOUT_MS });
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw this.codeError(`code 节点执行失败: ${message}`);
    }

    // 约定：代码必须返回对象；返回非对象时包成 { value }，避免下游拿不到结构化数据。
    if (this.isRecord(result)) {
      return result;
    }
    return { value: result ?? null };
  }

  private codeError(message: string): BusinessException {
    return new BusinessException(
      message,
      ErrorCode.BadRequest,
      HttpStatus.BAD_REQUEST,
    );
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
