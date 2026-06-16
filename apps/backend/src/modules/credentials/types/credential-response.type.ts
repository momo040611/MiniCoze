import {
  WorkspaceCredentialStatus,
  WorkspaceCredentialType,
} from '@prisma/client';

// 凭证响应对象刻意不包含 secretEncrypted 和明文 secret。
export interface CredentialResponse {
  id: string;
  workspaceId: string;
  name: string;
  type: WorkspaceCredentialType;
  maskedHint: string;
  config: unknown;
  status: WorkspaceCredentialStatus;
  lastUsedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// 删除凭证前用于提示被哪些 Provider 引用。
export interface CredentialReferenceResponse {
  modelProviders: Array<{
    id: string;
    name: string;
    providerType: string;
    enabled: boolean;
  }>;
}

// 运行时内部类型，包含解密后的明文 secret，只能在后端服务间使用。
export interface RuntimeCredential {
  id: string;
  type: WorkspaceCredentialType;
  secret: string;
  config: Record<string, unknown>;
}
