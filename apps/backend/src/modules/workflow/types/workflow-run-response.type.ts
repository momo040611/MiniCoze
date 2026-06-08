import { WorkflowRunNodeStatus, WorkflowRunStatus } from '@prisma/client';

export interface WorkflowRunNodeResponse {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: WorkflowRunNodeStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunResponse {
  id: string;
  workflowId: string;
  workflowVersionId: string | null;
  workflowName?: string | null;
  workflowVersion?: number | null;
  workspaceId: string;
  startedBy: string;
  status: WorkflowRunStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  nodes?: WorkflowRunNodeResponse[];
}
