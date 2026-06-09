import { WorkflowNode } from '../../workflow-definition.validator';

// 持久化变量的归属上下文：决定变量写到数据库的哪一行。
export interface WorkflowVariableContext {
  workspaceId: string;
  // 会话作用域键（一般是 sessionId）；为空表示当前运行没有会话，session 变量不可写。
  sessionKey?: string;
  // 全局作用域键（一般是 userId）。
  globalKey: string;
}

export interface WorkflowRuntimeState {
  originalInput: Record<string, unknown>;
  currentText: string;
  nodeOutputs: Record<string, Record<string, unknown>>;
  // 持久化变量的内存副本：运行开始时从库加载，set 节点会就地更新，
  // 供后续节点通过 {{session.x}} / {{global.x}} 读取。
  sessionVars: Record<string, unknown>;
  globalVars: Record<string, unknown>;
  variableContext: WorkflowVariableContext;
}

export interface WorkflowNodeExecutionContext {
  node: WorkflowNode;
  input: Record<string, unknown>;
  state: WorkflowRuntimeState;
  // 解析模板字符串中的 {{...}} 引用（已绑定当前循环作用域）。
  resolveTemplate(template: string): string;
  // 解析单个引用，返回原始值（可能是数组/对象/数字等）。
  resolveValue(ref: unknown): unknown;
}

export interface WorkflowNodeExecutionResult {
  output: Record<string, unknown>;
  // 分支节点（如 selector）用它告诉 runner 应该走哪个出口端口。
  nextPort?: string;
}

export interface WorkflowNodeExecutor {
  readonly type: string;
  execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult>;
}
