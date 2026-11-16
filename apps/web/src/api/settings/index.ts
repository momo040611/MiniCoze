// 设置模块 API — 工作区凭证（密钥）管理，对接后端 CredentialsController
// 凭证读取永远不返回密文或明文，仅返回 maskedHint 掩码提示。

import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from '../workspace';

export type CredentialType = 'BEARER_TOKEN' | 'API_KEY_HEADER' | 'BASIC_AUTH';

export type CredentialStatus = 'ACTIVE' | 'DISABLED';

export interface WorkspaceCredential {
  id: string;
  workspaceId: string;
  name: string;
  type: CredentialType;
  maskedHint: string;
  config: unknown;
  status: CredentialStatus;
  lastUsedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialReference {
  modelProviders: Array<{
    id: string;
    name: string;
    providerType: string;
    enabled: boolean;
  }>;
}

export async function listCredentials(): Promise<WorkspaceCredential[]> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<WorkspaceCredential[]>>(
    `workspaces/${workspaceId}/credentials`,
  );
  return res.data ?? [];
}

export async function createCredential(input: {
  name: string;
  type: CredentialType;
  secret: string;
  config?: Record<string, unknown>;
}): Promise<WorkspaceCredential> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.post<ApiEnvelope<WorkspaceCredential>>(
    `workspaces/${workspaceId}/credentials`,
    input,
  );
  return res.data;
}

export async function deleteCredential(credentialId: string): Promise<void> {
  const workspaceId = await getCurrentWorkspaceId();
  await http.delete(`workspaces/${workspaceId}/credentials/${credentialId}`);
}

export async function getCredentialReferences(
  credentialId: string,
): Promise<CredentialReference> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<CredentialReference>>(
    `workspaces/${workspaceId}/credentials/${credentialId}/references`,
  );
  return res.data;
}
