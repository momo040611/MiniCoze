import { FilePurpose, FileStatus, FileVisibility } from '@prisma/client';

export interface FileResponse {
  id: string;
  workspaceId: string | null;
  ownerId: string;
  purpose: FilePurpose;
  visibility: FileVisibility;
  status: FileStatus;
  originalName: string;
  mimeType: string;
  extension: string | null;
  size: number;
  url: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileListResponse {
  items: FileResponse[];
  total: number;
  page: number;
  pageSize: number;
}
