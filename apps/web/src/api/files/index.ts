import { API_BASE_URL, getAuthToken, http, type ApiEnvelope } from '../http';

export interface UploadedFileAsset {
  id: string;
  workspaceId: string | null;
  ownerId: string;
  purpose: string;
  visibility: string;
  status: string;
  originalName: string;
  mimeType: string;
  extension: string | null;
  size: number;
  url: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FilePurpose =
  | 'USER_AVATAR'
  | 'WORKSPACE_AVATAR'
  | 'AGENT_AVATAR'
  | 'PLUGIN_ICON'
  | 'KNOWLEDGE_DOCUMENT'
  | 'CHAT_ATTACHMENT'
  | 'WORKFLOW_ATTACHMENT'
  | 'TEMP_UPLOAD';

export async function uploadFile(
  file: File,
  purpose: FilePurpose,
  workspaceId?: string,
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);
  if (workspaceId) {
    formData.append('workspaceId', workspaceId);
  }

  const res = await http.request<ApiEnvelope<UploadedFileAsset>>(
    'files/upload',
    {
      method: 'POST',
      body: formData,
    },
  );

  return res.data;
}

export async function uploadChatAttachment(file: File, workspaceId: string) {
  return uploadFile(file, 'CHAT_ATTACHMENT', workspaceId);
}

export async function getFileObjectUrl(fileId: string): Promise<string> {
  const token = getAuthToken();
  const response = await fetch(
    `${API_BASE_URL.replace(/\/$/, '')}/files/${encodeURIComponent(fileId)}/content`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );

  if (!response.ok) {
    throw new Error(`加载文件失败 (${response.status})`);
  }

  return URL.createObjectURL(await response.blob());
}
