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

// 对外（SSE）暴露的运行级事件，配合节点事件一起推给前端。
export type WorkflowStreamEvent =
  | { type: 'run.created'; runId: string }
  | { type: 'run.completed'; runId: string; output: Record<string, unknown> }
  | { type: 'run.failed'; runId: string; errorMessage: string }
  | { type: 'stream.done'; runId: string }
  | WorkflowRunEvent;
