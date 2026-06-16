import type { KnowledgeStatusEvent, TokenUsage } from '../../api/agent-runtime';
import type { ToolCallData } from '../agent-config/components/ToolCallCard';

export interface ChatAttachment {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  sizeText: string;
  isImage: boolean;
}

export interface ChatMessage {
  kind: 'message';
  id: string;
  text: string;
  sender: 'user' | 'agent';
  time: string;
  status: 'sending' | 'streaming' | 'success' | 'failed';
  attachments: ChatAttachment[];
  agentName?: string;
  agentIcon?: string;
  messageId?: string;
  errorText?: string;
}

export interface ToolCallMessage {
  kind: 'tool-call';
  id: string;
  toolData: ToolCallData;
  time?: string;
}

export interface KnowledgeMessage {
  kind: 'knowledge';
  id: string;
  knowledgeEvent: KnowledgeStatusEvent;
  time?: string;
}

export interface DebugMessage {
  kind: 'debug';
  id: string;
  runId: string;
  model: string;
  latency: number;
  usage: TokenUsage | null;
  toolCalls: ToolCallData[];
  time?: string;
}

export interface ErrorMessage {
  kind: 'error';
  id: string;
  errorText: string;
  retryText: string;
}

export type ChatItem =
  | ChatMessage
  | ToolCallMessage
  | KnowledgeMessage
  | DebugMessage
  | ErrorMessage;

export interface SelectedChatAttachment {
  file: File;
  previewUrl: string;
  isImage: boolean;
  sizeText: string;
  uploadStatus: 'uploading' | 'success' | 'failed';
  attachment?: ChatAttachment;
  errorText?: string;
}
