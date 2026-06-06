// 发布模块 API — 对接后端 /publish 接口
// 包含：Agent 发布/下线/版本/记录/回滚 + 渠道管理 + 工作流发布

import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from '../workspace';

// ==================== 通用类型 ====================

export interface AgentItem {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedAgents {
  list: AgentItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedWorkflows {
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

export interface PublishRecordItem {
  id: string;
  action: 'PUBLISH' | 'OFFLINE' | 'ROLLBACK';
  versionId: string | null;
  version: number | null;
  reason: string | null;
  operatorId: string;
  operatorName: string;
  createdAt: string;
}

export interface RollbackAgentResponse {
  currentVersionId: string;
  rolledBackAt: string;
}

// ==================== 发布渠道相关 ====================

export type PublishChannelType = 'WEB' | 'API';

export interface WebPublishChannelConfig {
  slug: string;
  publicPath: string;
  embedPath: string;
  allowAnonymous: boolean;
  theme: string;
  showBranding: boolean;
  allowedOrigins: string[];
}

export interface ApiPublishChannelConfig {
  apiKeyHash: string | null;
  apiKeyPrefix: string | null;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  allowedOrigins: string[];
  allowedIps: string[];
  expiresAt: string | null;
}

export type PublishChannelConfig =
  | WebPublishChannelConfig
  | ApiPublishChannelConfig;

export interface PublishChannelResponse {
  id: string;
  channel: PublishChannelType;
  enabled: boolean;
  config: PublishChannelConfig;
  createdAt: string;
  updatedAt: string;
}

export interface RotateApiKeyResponse {
  apiKey: string;
  apiKeyPrefix: string;
  rotatedAt: string;
}

export interface UpdateChannelConfigPayload {
  allowAnonymous?: boolean;
  theme?: string;
  showBranding?: boolean;
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
  allowedOrigins?: string[];
  allowedIps?: string[];
  expiresAt?: string | null;
}

// ==================== 工作流发布相关 ====================

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

// ==================== API 方法 ====================

/** 获取智能体列表（用于发布面板） */
export async function getAgentList(): Promise<AgentItem[]> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<PaginatedAgents>>('agents', {
    query: { workspaceId, page: 1, pageSize: 50 },
  });
  return res.data.list;
}

/** 检查 Agent 是否满足发布条件 */
export async function checkAgent(
  agentId: string,
): Promise<PublishCheckResponse> {
  const res = await http.get<ApiEnvelope<PublishCheckResponse>>(
    `publish/agents/${agentId}/check`,
  );
  return res.data;
}

/** 发布 Agent（创建版本快照） */
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

/** 获取发布版本列表 */
export async function getAgentVersions(
  agentId: string,
): Promise<AgentVersionItem[]> {
  const res = await http.get<ApiEnvelope<AgentVersionItem[]>>(
    `publish/agents/${agentId}/versions`,
  );
  return res.data;
}

/** 获取发布操作记录（过滤渠道启停等噪音记录） */
export async function getAgentRecords(
  agentId: string,
): Promise<PublishRecordItem[]> {
  const res = await http.get<ApiEnvelope<PublishRecordItem[]>>(
    `publish/agents/${agentId}/records`,
  );
  return res.data.filter((r) =>
    r.action === 'PUBLISH' || r.action === 'OFFLINE' || r.action === 'ROLLBACK',
  );
}

/** 回滚到指定版本 */
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

// ---- 发布渠道 API ----

/** 查询 Agent 发布渠道配置列表 */
export async function listAgentChannels(
  agentId: string,
): Promise<PublishChannelResponse[]> {
  const res = await http.get<ApiEnvelope<PublishChannelResponse[]>>(
    `publish/agents/${agentId}/channels`,
  );
  return res.data;
}

/** 重新生成 API 渠道 Key（返回完整 Key，仅此一次） */
export async function rotateApiKey(
  agentId: string,
  reason?: string,
): Promise<RotateApiKeyResponse> {
  const res = await http.post<ApiEnvelope<RotateApiKeyResponse>>(
    `publish/agents/${agentId}/channels/api/rotate-key`,
    reason ? { reason } : {},
  );
  return res.data;
}

/** 更新 Agent 发布渠道配置 */
export async function updateAgentChannel(
  agentId: string,
  channel: PublishChannelType,
  config: UpdateChannelConfigPayload,
): Promise<PublishChannelResponse> {
  const res = await http.put<ApiEnvelope<PublishChannelResponse>>(
    `publish/agents/${agentId}/channels/${channel}`,
    config,
  );
  return res.data;
}

/** 启用 Agent 发布渠道 */
export async function enableAgentChannel(
  agentId: string,
  channel: PublishChannelType,
): Promise<PublishChannelResponse> {
  const res = await http.post<ApiEnvelope<PublishChannelResponse>>(
    `publish/agents/${agentId}/channels/${channel}/enable`,
  );
  return res.data;
}

/** 禁用 Agent 发布渠道 */
export async function disableAgentChannel(
  agentId: string,
  channel: PublishChannelType,
): Promise<PublishChannelResponse> {
  const res = await http.post<ApiEnvelope<PublishChannelResponse>>(
    `publish/agents/${agentId}/channels/${channel}/disable`,
  );
  return res.data;
}

// ---- 工作流发布 API ----

/** 获取工作流列表（用于发布面板） */
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
