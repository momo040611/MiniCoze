export interface DashboardAgentSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  updatedAt: string;
}

export interface DashboardConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  agent: {
    id: string;
    name: string;
  };
}

export interface DashboardSummary {
  agentCount: number;
  conversationCount: number;
  workflowCount: number;
  pluginCount: number;
  knowledgeBaseCount: number;
  recentAgents: DashboardAgentSummary[];
  recentConversations: DashboardConversationSummary[];
}
