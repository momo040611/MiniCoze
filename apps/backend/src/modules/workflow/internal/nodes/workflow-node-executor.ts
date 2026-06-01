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
}

export interface WorkflowNodeExecutionResult {
  output: Record<string, unknown>;
}

export interface WorkflowNodeExecutor {
  readonly type: string;
  execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult>;
}
