import { http, type ApiEnvelope } from '../http';

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

export async function uploadChatAttachment(file: File, workspaceId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'CHAT_ATTACHMENT');
  formData.append('workspaceId', workspaceId);

  const res = await http.request<ApiEnvelope<UploadedFileAsset>>(
    'files/upload',
    {
      method: 'POST',
      body: formData,
    },
  );

  return res.data;
}
