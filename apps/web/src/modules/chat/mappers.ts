import type { BackendMessage, ConversationDetail } from '../../api/homepage';
import { formatFileSize } from '../homepage/utils/format';
import type { ChatAttachment, ChatMessage } from './types';

function parseAttachment(value: unknown): ChatAttachment | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.fileId !== 'string') return null;

  const name = typeof item.name === 'string' ? item.name : '未命名附件';
  const mimeType = typeof item.mimeType === 'string' ? item.mimeType : '';
  const size = typeof item.size === 'number' ? item.size : 0;

  return {
    fileId: item.fileId,
    name,
    mimeType,
    size,
    sizeText: formatFileSize(size),
    isImage: mimeType.startsWith('image/'),
  };
}

export function parseMessageAttachments(metadata: unknown): ChatAttachment[] {
  if (!metadata || typeof metadata !== 'object' || !('attachments' in metadata)) {
    return [];
  }

  const attachments = (metadata as { attachments?: unknown }).attachments;
  if (!Array.isArray(attachments)) return [];

  return attachments
    .map(parseAttachment)
    .filter((item): item is ChatAttachment => item !== null);
}

export function mapBackendMessage(
  message: BackendMessage,
  agent: ConversationDetail['agent'],
): ChatMessage | null {
  if (message.role !== 'USER' && message.role !== 'ASSISTANT') return null;

  return {
    kind: 'message',
    id: message.id,
    text: message.content,
    sender: message.role === 'USER' ? 'user' : 'agent',
    time: new Date(message.createdAt).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: message.errorMessage ? 'failed' : 'success',
    errorText: message.errorMessage ?? undefined,
    attachments: parseMessageAttachments(message.metadata),
    agentName: message.role === 'ASSISTANT' ? agent?.name : undefined,
    agentIcon: message.role === 'ASSISTANT' ? agent?.avatarUrl ?? undefined : undefined,
  };
}

export function mapConversationMessages(detail: ConversationDetail): ChatMessage[] {
  return detail.messages
    .map((message) => mapBackendMessage(message, detail.agent))
    .filter((message): message is ChatMessage => message !== null);
}
