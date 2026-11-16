import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadChatAttachment } from '../../../api/files';
import { getCurrentWorkspaceId } from '../../../api/workspace';
import { formatFileSize } from '../../homepage/utils/format';
import type { ChatAttachment, SelectedChatAttachment } from '../types';

const SUPPORTED_TEXT_EXTENSIONS = new Set(['txt', 'md']);
const SUPPORTED_TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
]);
// 后端 RuntimeAttachmentService 已支持解析为文本的文档格式。
const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'xls', 'csv']);

// 单条消息最多附件数量（防止请求体过大）。
export const MAX_CHAT_ATTACHMENTS = 10;

export const CHAT_ATTACHMENT_ACCEPT =
  'image/png,image/jpg,image/jpeg,image/gif,image/webp,.txt,.md,.pdf,.docx,.xlsx,.xls,.csv';

function isSupported(file: File) {
  if (file.type.startsWith('image/')) return true;
  if (SUPPORTED_TEXT_MIME_TYPES.has(file.type)) return true;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  return (
    SUPPORTED_TEXT_EXTENSIONS.has(extension) ||
    SUPPORTED_DOCUMENT_EXTENSIONS.has(extension)
  );
}

let attachmentIdSeed = 0;
function nextAttachmentId() {
  attachmentIdSeed += 1;
  return `attachment-${attachmentIdSeed}`;
}

export function useChatAttachments() {
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedChatAttachment[]>([]);
  const selectedRef = useRef(selectedAttachments);

  useEffect(() => {
    selectedRef.current = selectedAttachments;
  }, [selectedAttachments]);

  const clearAttachments = useCallback(() => {
    selectedRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setSelectedAttachments([]);
  }, []);

  useEffect(() => clearAttachments, [clearAttachments]);

  const removeAttachment = useCallback((id: string) => {
    setSelectedAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<SelectedChatAttachment>) => {
    setSelectedAttachments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const uploadOne = useCallback(
    async (item: SelectedChatAttachment) => {
      try {
        const workspaceId = await getCurrentWorkspaceId();
        const uploaded = await uploadChatAttachment(item.file, workspaceId);
        const attachment: ChatAttachment = {
          fileId: uploaded.id,
          name: uploaded.originalName,
          mimeType: uploaded.mimeType,
          size: uploaded.size,
          sizeText: item.sizeText,
          isImage: item.isImage,
        };
        patchItem(item.id, { uploadStatus: 'success', attachment });
      } catch (error) {
        patchItem(item.id, {
          uploadStatus: 'failed',
          errorText: error instanceof Error ? error.message : '附件上传失败',
        });
      }
    },
    [patchItem],
  );

  const selectFiles = useCallback(
    (input: File | File[] | FileList | null): { acceptedCount: number; rejectedCount: number } => {
      const files = input instanceof File ? [input] : Array.from(input ?? []);
      if (files.length === 0) return { acceptedCount: 0, rejectedCount: 0 };

      const remaining = Math.max(MAX_CHAT_ATTACHMENTS - selectedRef.current.length, 0);
      const accepted = files.slice(0, remaining);
      const rejectedCount = files.length - accepted.length;
      if (accepted.length === 0) {
        return { acceptedCount: 0, rejectedCount };
      }

      const items: SelectedChatAttachment[] = accepted.map((file) => {
        const isImage = file.type.startsWith('image/');
        const previewUrl = isImage ? URL.createObjectURL(file) : '';
        const base: SelectedChatAttachment = {
          id: nextAttachmentId(),
          file,
          previewUrl,
          isImage,
          sizeText: formatFileSize(file.size),
          uploadStatus: 'uploading',
        };

        if (!isSupported(file)) {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          return {
            ...base,
            previewUrl: '',
            uploadStatus: 'failed',
            errorText: '附件仅支持图片、txt/md 文本与 pdf/docx/xlsx 文档',
          };
        }

        return base;
      });

      setSelectedAttachments((current) => [...current, ...items]);

      // 并行上传所有受支持的附件。
      items.forEach((item) => {
        if (item.uploadStatus === 'uploading') {
          void uploadOne(item);
        }
      });

      return { acceptedCount: items.length, rejectedCount };
    },
    [uploadOne],
  );

  const selectedAttachment = selectedAttachments[0] ?? null;
  const readyAttachments = selectedAttachments
    .map((item) => item.attachment)
    .filter((item): item is ChatAttachment => item !== undefined);
  const firstFailed = selectedAttachments.find((item) => item.uploadStatus === 'failed') ?? null;

  return {
    selectedAttachments,
    selectedAttachment,
    readyAttachments,
    selectFiles,
    clearAttachments,
    removeAttachment,
    uploading: selectedAttachments.some((item) => item.uploadStatus === 'uploading'),
    failed: selectedAttachments.some((item) => item.uploadStatus === 'failed'),
    firstFailedError: firstFailed?.errorText ?? null,
    isFull: selectedAttachments.length >= MAX_CHAT_ATTACHMENTS,
  };
}
