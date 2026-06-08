import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from '../workspace';

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
  agent: { id: string; name: string };
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

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<DashboardSummary>>(
    `workspaces/${workspaceId}/dashboard`,
  );
  return res.data;
}

export interface ActivityItem {
  id: string;
  type: 'agent' | 'conversation' | 'workflow';
  title: string;
  subtitle: string;
  status?: string;
  statusColor?: string;
  timestamp: string;
  relativeTime: string;
  targetPath: string;
}

export interface StatItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  value: number;
  trend?: number;
  accentColor: string;
  targetPath: string;
}

export interface QuickAction {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  targetPath: string;
}

export interface SystemStatusData {
  plugins: { enabled: number; total: number; updateAvailable: number };
  publish: { pending: number; published: number };
  knowledge: { synced: number; total: number };
}

export { setupDashboardMocks } from './setup-mocks';
