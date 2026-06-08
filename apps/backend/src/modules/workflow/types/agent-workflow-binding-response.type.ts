export interface AgentWorkflowBindingResponse {
  bindingId: string;
  agentId: string;
  workflowId: string;
  workflowVersionId: string;
  workflowName: string;
  workflowDescription: string | null;
  workflowVersion: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
