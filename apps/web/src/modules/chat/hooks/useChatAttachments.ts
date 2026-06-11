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

export const CHAT_ATTACHMENT_ACCEPT =
  'image/png,image/jpg,image/jpeg,image/gif,image/webp,.txt,.md';

function isSupported(file: File) {
  if (file.type.startsWith('image/')) return true;
  if (SUPPORTED_TEXT_MIME_TYPES.has(file.type)) return true;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension ? SUPPORTED_TEXT_EXTENSIONS.has(extension) : false;
}

export function useChatAttachments() {
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedChatAttachment[]>([]);
  const uploadSequenceRef = useRef(0);
  const selectedRef = useRef(selectedAttachments);

  useEffect(() => {
    selectedRef.current = selectedAttachments;
  }, [selectedAttachments]);

  const clearAttachments = useCallback(() => {
    uploadSequenceRef.current += 1;
    selectedRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setSelectedAttachments([]);
  }, []);

  useEffect(() => clearAttachments, [clearAttachments]);

  const selectFile = useCallback(async (file: File) => {
    clearAttachments();
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : '';
    const sizeText = formatFileSize(file.size);
    const sequence = uploadSequenceRef.current + 1;
    uploadSequenceRef.current = sequence;

    if (!isSupported(file)) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedAttachments([{
        file,
        previewUrl: '',
        isImage,
        sizeText,
        uploadStatus: 'failed',
        errorText: '当前仅支持图片和 txt/md 文本附件',
      }]);
      return;
    }

    setSelectedAttachments([{
      file,
      previewUrl,
      isImage,
      sizeText,
      uploadStatus: 'uploading',
    }]);

    try {
      const workspaceId = await getCurrentWorkspaceId();
      const uploaded = await uploadChatAttachment(file, workspaceId);
      if (uploadSequenceRef.current !== sequence) return;

      const attachment: ChatAttachment = {
        fileId: uploaded.id,
        name: uploaded.originalName,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        sizeText,
        isImage,
      };
      setSelectedAttachments([{
        file,
        previewUrl,
        isImage,
        sizeText,
        uploadStatus: 'success',
        attachment,
      }]);
    } catch (error) {
      if (uploadSequenceRef.current !== sequence) return;
      setSelectedAttachments([{
        file,
        previewUrl,
        isImage,
        sizeText,
        uploadStatus: 'failed',
        errorText: error instanceof Error ? error.message : '附件上传失败',
      }]);
    }
  }, [clearAttachments]);

  const selectedAttachment = selectedAttachments[0] ?? null;
  const readyAttachments = selectedAttachments
    .map((item) => item.attachment)
    .filter((item): item is ChatAttachment => item !== undefined);

  return {
    selectedAttachments,
    selectedAttachment,
    readyAttachments,
    selectFile,
    clearAttachments,
    removeAttachment: clearAttachments,
    uploading: selectedAttachment?.uploadStatus === 'uploading',
    failed: selectedAttachment?.uploadStatus === 'failed',
  };
}
