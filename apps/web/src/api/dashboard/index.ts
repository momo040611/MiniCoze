// 工作台 Dashboard API — 对接后端 GET workspaces/:workspaceId/dashboard

import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from '../workspace';

// ---- 类型定义（与后端 dashboard-summary.type.ts 对齐）----

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
  agent: { id: string; name: string };
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

// ---- API 函数 ----

/** 获取当前工作空间的仪表盘摘要数据 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<DashboardSummary>>(
    `workspaces/${workspaceId}/dashboard`,
  );
  return res.data;
}

export { setupDashboardMocks } from './setup-mocks';
