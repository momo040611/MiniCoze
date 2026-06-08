export interface DashboardAgentSummary {
  id: string;
  name: string;
  description?: string;
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

export interface DashboardWorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  duration?: number;
}

export interface DashboardRunLog {
  id: string;
  type: 'tool_call' | 'knowledge_retrieval' | 'workflow_step';
  agentName: string;
  content: string;
  timestamp: string;
  status?: 'success' | 'failed';
}

export interface DashboardSummary {
  agentCount: number;
  conversationCount: number;
  workflowCount: number;
  pluginCount: number;
  knowledgeBaseCount: number;
  publishPendingCount: number;
  pluginEnabledCount: number;
  pluginUpdateCount: number;
  memberCount: number;
  recentAgents: DashboardAgentSummary[];
  recentConversations: DashboardConversationSummary[];
  recentWorkflows: DashboardWorkflowRun[];
  recentLogs: DashboardRunLog[];
}
