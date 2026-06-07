// 工作台 Dashboard API — 对接后端 GET workspaces/:workspaceId/dashboard

import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from '../workspace';

// ---- 类型定义（与后端 dashboard-summary.type.ts 对齐）----

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

/** 工作流运行记录 */
export interface DashboardWorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  duration?: number; // 毫秒
}

/** 统一运行日志条目 */
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
  // 新增字段
  publishPendingCount: number;
  pluginEnabledCount: number;
  pluginUpdateCount: number;
  memberCount: number;
  recentAgents: DashboardAgentSummary[];
  recentConversations: DashboardConversationSummary[];
  recentWorkflows: DashboardWorkflowRun[];
  recentLogs: DashboardRunLog[];
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

// ---- 前端派生类型（用于 UI 组件）----

/** 统一活动时间线条目 */
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

/** 统计卡片数据 */
export interface StatItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  value: number;
  trend?: number;
  accentColor: string;
  targetPath: string;
}

/** 快捷操作定义 */
export interface QuickAction {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  targetPath: string;
}

/** 系统状态数据 */
export interface SystemStatusData {
  plugins: { enabled: number; total: number; updateAvailable: number };
  publish: { pending: number; published: number };
  knowledge: { synced: number; total: number };
}

export { setupDashboardMocks } from './setup-mocks';
