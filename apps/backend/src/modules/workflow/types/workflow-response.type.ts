import { WorkflowStatus } from '@prisma/client';

export interface WorkflowResponse {
  id: string;
  workspaceId: string;
  creatorId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  draftDefinition: Record<string, unknown> | null;
  currentVersionId: string | null;
  currentVersion: number | null;
  createdAt: string;
  updatedAt: string;
}
