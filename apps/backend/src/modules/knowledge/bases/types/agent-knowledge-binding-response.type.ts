import type { RuntimeKnowledgeBindingConfig } from '../../../../shared/types/agent';

export interface AgentKnowledgeBindingResponse {
  bindingId: string;
  agentId: string;
  knowledgeBaseId: string;
  name: string;
  enabled: boolean;
  config: RuntimeKnowledgeBindingConfig | null;
  createdAt: string;
  updatedAt: string;
}
