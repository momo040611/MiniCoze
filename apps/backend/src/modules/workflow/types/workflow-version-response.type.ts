export interface WorkflowVersionResponse {
  id: string;
  workflowId: string;
  createdBy: string;
  version: number;
  definition: Record<string, unknown>;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  changelog: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
