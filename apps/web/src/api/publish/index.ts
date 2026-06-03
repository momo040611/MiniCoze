// 发布模块 API — 对接后端 /publish 接口

import { http, type ApiEnvelope } from '../http';

// ---- 类型定义 ----
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

export interface AgentVersionListItem {
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

// ---- API 方法 ----

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
export async function listAgentVersions(
  agentId: string,
): Promise<AgentVersionListItem[]> {
  const res = await http.get<ApiEnvelope<AgentVersionListItem[]>>(
    `publish/agents/${agentId}/versions`,
  );
  return res.data;
}

/** 获取发布操作记录 */
export async function listAgentRecords(
  agentId: string,
): Promise<unknown[]> {
  const res = await http.get<ApiEnvelope<unknown[]>>(
    `publish/agents/${agentId}/records`,
  );
  return res.data;
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
