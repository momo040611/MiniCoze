import { ModelConnectionStatus, ModelProviderType } from '@prisma/client';

// 模型服务响应只返回凭证 ID 和掩码信息相关字段，不返回任何密钥内容。
export interface ModelProviderResponse {
  id: string;
  workspaceId: string;
  credentialId: string;
  createdBy: string;
  name: string;
  providerType: ModelProviderType;
  baseUrl: string;
  enabled: boolean;
  connectionStatus: ModelConnectionStatus;
  lastTestMessage: string | null;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 工作区模型响应额外带 isDefault，方便前端后续设置页直接展示默认模型状态。
export interface WorkspaceModelResponse {
  id: string;
  workspaceId: string;
  providerId: string;
  modelId: string;
  displayName: string;
  enabled: boolean;
  capabilities: unknown;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// 引用查询用于删除前提示：哪些 Agent、默认设置或工作流仍在使用该模型。
export interface ModelReferenceResponse {
  agents: Array<{ id: string; name: string; status: string }>;
  isDefault: boolean;
  workflowNodes: Array<{ workflowId: string; workflowName: string }>;
}
