// 对话管理 API — 对接后端 NestJS conversation 模块

import { http, type ApiEnvelope } from '../http'
import { getCurrentWorkspaceId } from '../workspace'

// ---- 类型：匹配后端 Prisma 返回结构 ----

export interface Conversation {
  id: string
  agentId: string
  userId: string
  title: string | null
  isPreview?: boolean
  createdAt: string
  updatedAt: string
}

export interface BackendMessage {
  id: string
  conversationId: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  model: string | null
  tokenUsage: unknown
  metadata: unknown
  errorMessage: string | null
  createdAt: string
}

export interface ConversationDetail {
  id: string
  agentId: string
  userId: string
  title: string | null
  isPreview?: boolean
  createdAt: string
  updatedAt: string
  agent: {
    id: string
    name: string
    description: string | null
    avatarUrl: string | null
  } | null
  messages: BackendMessage[]
}

// ---- 前端使用的消息类型 ----

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  conversationId: string
  createdAt: string
}

async function getWorkspacePrefix(): Promise<string> {
  const workspaceId = await getCurrentWorkspaceId();
  return `workspaces/${workspaceId}/conversations`;
}

// ---- API 方法 ----

export async function getConversations(
  agentId: string,
  options?: { preview?: boolean },
): Promise<Conversation[]> {
  const prefix = await getWorkspacePrefix();
  const res = await http.get<ApiEnvelope<Conversation[]>>(
    `${prefix}/agents/${agentId}`,
    { query: options?.preview === undefined ? undefined : { preview: options.preview } },
  );
  return res.data ?? [];
}

export async function getConversation(conversationId: string): Promise<ConversationDetail | null> {
  try {
    const prefix = await getWorkspacePrefix();
    const res = await http.get<ApiEnvelope<ConversationDetail>>(`${prefix}/${conversationId}`);
    return res.data;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const prefix = await getWorkspacePrefix();
  await http.delete(`${prefix}/${conversationId}`);
}

export { getCurrentWorkspaceId };
