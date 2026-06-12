import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { WorkflowVariableScope } from '@prisma/client';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { WorkflowVariableService } from '../variable/workflow-variable.service';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
  WorkflowRuntimeState,
} from './workflow-node-executor';

// VariableNodeExecutor：读写持久化变量的节点，实现工作流“记忆”能力。
// 配置（data.inputs）：
// - operation: 'set' | 'get'      操作类型（默认 set）
// - scope:     'session' | 'global'  作用域（默认 session）
// - name:      string             变量名（必填）
// - value:     any                仅 set 用；支持 {{...}} 引用，保留原始类型
//
// 说明：
// - set 会写库并就地更新运行时内存，后续节点可立即通过 {{session.x}}/{{global.x}} 读到
// - get 直接从运行时内存读取（已包含运行开始时加载的值 + 本次运行内的 set 更新）
@Injectable()
export class VariableNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'variable';
  private readonly logger = new Logger(VariableNodeExecutor.name);

  constructor(private readonly variableService: WorkflowVariableService) {}

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const inputs = this.asRecord(this.asRecord(context.node.data).inputs);
    const operation = inputs.operation === 'get' ? 'get' : 'set';
    const scope = this.resolveScope(inputs.scope);
    const name = typeof inputs.name === 'string' ? inputs.name.trim() : '';

    if (!name) {
      throw new BusinessException(
        `variable 节点 ${context.node.id} 缺少变量名 name`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (operation === 'get') {
      return this.handleGet(context.state, scope, name);
    }
    return this.handleSet(context, scope, name, inputs.value);
  }

  private handleGet(
    state: WorkflowRuntimeState,
    scope: WorkflowVariableScope,
    name: string,
  ): WorkflowNodeExecutionResult {
    const store = this.memoryStore(state, scope);
    const value = store[name];
    this.logger.debug(
      `[variable] get ${this.scopeLabel(scope)}.${name} => ${this.preview(value)}`,
    );
    return {
      output: { operation: 'get', scope: this.scopeLabel(scope), name, value },
    };
  }

  private async handleSet(
    context: WorkflowNodeExecutionContext,
    scope: WorkflowVariableScope,
    name: string,
    rawValue: unknown,
  ): Promise<WorkflowNodeExecutionResult> {
    const state = context.state;
    // 解析 value：支持 {{...}} 引用，保留原始类型（数组/对象/数字等）。
    const value = context.resolveValue(rawValue);
    const scopeKey = this.resolveScopeKey(state, scope);

    await this.variableService.set(
      state.variableContext.workspaceId,
      scope,
      scopeKey,
      name,
      value,
    );
    // 就地更新内存副本，使本次运行内后续节点能立即读到新值。
    this.memoryStore(state, scope)[name] = value;

    this.logger.debug(
      `[variable] set ${this.scopeLabel(scope)}.${name} = ${this.preview(value)}`,
    );
    return {
      output: { operation: 'set', scope: this.scopeLabel(scope), name, value },
    };
  }

  // 取作用域对应的内存映射（与 {{session.x}}/{{global.x}} 读取的是同一份）。
  private memoryStore(
    state: WorkflowRuntimeState,
    scope: WorkflowVariableScope,
  ): Record<string, unknown> {
    return scope === WorkflowVariableScope.SESSION
      ? state.sessionVars
      : state.globalVars;
  }

  // 取写库用的 scopeKey：SESSION 用 sessionKey，GLOBAL 用 globalKey。
  // SESSION 作用域但本次运行没有 sessionId 时直接报错（无处可写）。
  private resolveScopeKey(
    state: WorkflowRuntimeState,
    scope: WorkflowVariableScope,
  ): string {
    if (scope === WorkflowVariableScope.SESSION) {
      const key = state.variableContext.sessionKey;
      if (!key) {
        throw new BusinessException(
          '写入 session 变量需要在运行输入里提供 sessionId',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
      return key;
    }
    return state.variableContext.globalKey;
  }

  private resolveScope(value: unknown): WorkflowVariableScope {
    return value === 'global'
      ? WorkflowVariableScope.GLOBAL
      : WorkflowVariableScope.SESSION;
  }

  private scopeLabel(scope: WorkflowVariableScope): string {
    return scope === WorkflowVariableScope.GLOBAL ? 'global' : 'session';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private preview(value: unknown): string {
    try {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      if (text === undefined) {
        return 'undefined';
      }
      return text.length > 200 ? `${text.slice(0, 200)}…` : text;
    } catch {
      return String(value);
    }
  }
}
