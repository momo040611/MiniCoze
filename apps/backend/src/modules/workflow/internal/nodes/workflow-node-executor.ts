import { WorkflowNode } from '../../workflow-definition.validator';

export interface WorkflowRuntimeState {
  originalInput: Record<string, unknown>;
  currentText: string;
  nodeOutputs: Record<string, Record<string, unknown>>;
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
