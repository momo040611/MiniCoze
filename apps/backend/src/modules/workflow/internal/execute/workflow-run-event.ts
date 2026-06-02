export type WorkflowRunEventType =
  | 'node.started'
  | 'node.completed'
  | 'node.failed';

export interface WorkflowRunEvent {
  type: WorkflowRunEventType;
  runId: string;
  nodeId: string;
  nodeType: string;
  at: Date;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
  durationMs?: number;
}
