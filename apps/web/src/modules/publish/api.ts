// 发布模块本地 API 层
// 聚合 Agent 发布 + Workflow 发布所需的后端接口调用

import { http, type ApiEnvelope } from '../../api/http';
import { getCurrentWorkspaceId } from '../../api/workspace';

// ==================== 通用类型 ====================

export interface AgentItem {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  status: string; // DRAFT | ACTIVE | ARCHIVED
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAgents {
  list: AgentItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowItem {
  id: string;
  name: string;
  description: string | null;
  status: string; // DRAFT | ACTIVE | ARCHIVED
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedWorkflows {
  list: WorkflowItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== Agent 发布相关 ====================

export interface PublishCheckItem {
  key: string;
  label: string;
  passed: boolean;
  message?: string;
}

export interface PublishCheckResponse {
  passed: boolean;
  items: PublishCheckItem[];
}

export interface PublishAgentResponse {
  versionId: string;
  version: number;
  publishedAt: string;
}

export interface OfflineAgentResponse {
  offlineAt: string;
}

export interface AgentVersionItem {
  id: string;
  version: number;
  changelog: string | null;
  isCurrent: boolean;
  publishedAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    username: string;
  };
}

export interface RollbackAgentResponse {
  currentVersionId: string;
  rolledBackAt: string;
}

/** 获取智能体列表 */
export async function getAgentList(): Promise<AgentItem[]> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<PaginatedAgents>>('agents', {
    query: { workspaceId, page: 1, pageSize: 50 },
  });
  return res.data.list;
}

/** 检查 Agent 是否满足发布条件 */
export async function checkAgent(agentId: string): Promise<PublishCheckResponse> {
  const res = await http.get<ApiEnvelope<PublishCheckResponse>>(
    `publish/agents/${agentId}/check`,
  );
  return res.data;
}

/** 发布 Agent */
export async function publishAgent(
  agentId: string,
  changelog?: string,
): Promise<PublishAgentResponse> {
  const res = await http.post<ApiEnvelope<PublishAgentResponse>>(
    `publish/agents/${agentId}`,
    changelog ? { changelog } : {},
  );
  return res.data;
}

/** 下线 Agent */
export async function offlineAgent(
  agentId: string,
  reason?: string,
): Promise<OfflineAgentResponse> {
  const res = await http.post<ApiEnvelope<OfflineAgentResponse>>(
    `publish/agents/${agentId}/offline`,
    reason ? { reason } : {},
  );
  return res.data;
}

/** 获取 Agent 发布版本列表 */
export async function getAgentVersions(agentId: string): Promise<AgentVersionItem[]> {
  const res = await http.get<ApiEnvelope<AgentVersionItem[]>>(
    `publish/agents/${agentId}/versions`,
  );
  return res.data;
}

/** 回滚 Agent */
export async function rollbackAgent(
  agentId: string,
  versionId: string,
  reason?: string,
): Promise<RollbackAgentResponse> {
  const res = await http.post<ApiEnvelope<RollbackAgentResponse>>(
    `publish/agents/${agentId}/rollback`,
    { versionId, reason },
  );
  return res.data;
}

// ==================== Workflow 发布相关 ====================

export interface WorkflowVersionItem {
  id: string;
  version: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface PublishWorkflowResponse {
  versionId: string;
  version: number;
  publishedAt: string;
}

/** 获取工作流列表 */
export async function getWorkflowList(): Promise<WorkflowItem[]> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<PaginatedWorkflows>>('workflows', {
    query: { workspaceId, page: 1, pageSize: 100 },
  });
  return res.data.list;
}

/** 发布工作流 */
export async function publishWorkflow(
  workflowId: string,
  params?: { inputSchema?: object; outputSchema?: object },
): Promise<PublishWorkflowResponse> {
  const res = await http.post<ApiEnvelope<PublishWorkflowResponse>>(
    `workflows/${workflowId}/publish`,
    params ?? {},
  );
  return res.data;
}

/** 获取工作流版本列表 */
export async function getWorkflowVersions(
  workflowId: string,
): Promise<WorkflowVersionItem[]> {
  const res = await http.get<ApiEnvelope<WorkflowVersionItem[]>>(
    `workflows/${workflowId}/versions`,
  );
  return res.data;
}
