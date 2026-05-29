import {
  WorkflowRunSource,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowVersionStatus,
} from '@prisma/client';

export interface WorkflowResponse {
  id: string;
  workspaceId: string;
  creatorId: string;
  name: string;
  description: string | null;
  graph: unknown;
  status: WorkflowStatus;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersionResponse {
  id: string;
  workflowId: string;
  version: number;
  snapshot: unknown;
  description: string | null;
  status: WorkflowVersionStatus;
  createdBy: string;
  createdAt: string;
}

export interface WorkflowRunResponse {
  id: string;
  workflowId: string;
  workflowVersionId: string | null;
  agentId: string | null;
  userId: string;
  conversationId: string | null;
  messageId: string | null;
  source: WorkflowRunSource;
  status: WorkflowRunStatus;
  input: unknown;
  output: unknown;
  errorMessage: string | null;
  startedAt: string;
  endedAt: string | null;
}
