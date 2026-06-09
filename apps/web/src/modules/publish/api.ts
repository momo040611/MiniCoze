// 发布模块本地 API — 从 api/publish 统一导出 + 公开分享 API
// 所有类型和函数均在 api/publish/index.ts 中维护

export {
  // 通用
  type AgentItem,
  type WorkflowItem,
  // Agent 发布
  type PublishCheckItem,
  type PublishCheckResponse,
  type PublishAgentResponse,
  type OfflineAgentResponse,
  type AgentVersionItem,
  type PublishRecordItem,
  type RollbackAgentResponse,
  // 渠道
  type PublishChannelType,
  type WebPublishChannelConfig,
  type ApiPublishChannelConfig,
  type PublishChannelConfig,
  type PublishChannelResponse,
  type RotateApiKeyResponse,
  type UpdateChannelConfigPayload,
  // 工作流发布
  type WorkflowVersionItem,
  type PublishWorkflowResponse,
  // 函数
  getAgentList,
  checkAgent,
  publishAgent,
  offlineAgent,
  getAgentVersions,
  getAgentRecords,
  rollbackAgent,
  listAgentChannels,
  rotateApiKey,
  updateAgentChannel,
  enableAgentChannel,
  disableAgentChannel,
  getWorkflowList,
  publishWorkflow,
  getWorkflowVersions,
} from '../../api/publish/index';

// ==================== 公开分享 API（无需登录） ====================

import { http, type ApiEnvelope, API_BASE_URL } from '../../api/http';
import type { RuntimeEvent } from '../../api/agent-runtime';

/** 公开智能体信息（对应后端 GET /public/agents/:slug） */
export interface PublicAgentInfo {
  name: string;
  description: string | null;
  avatarUrl: string | null;
  openingMessage: string | null;
}

/** 通过 slug 获取公开智能体信息（无需登录） */
export async function getPublicAgent(slug: string): Promise<PublicAgentInfo> {
  const res = await http.get<ApiEnvelope<PublicAgentInfo>>(
    `public/agents/${slug}`,
    { auth: false },
  );
  return res.data;
}

/** 公开聊天 SSE 流 — 对应后端 POST /public/agents/:slug/chat/stream */
export async function runPublicAgentStream(
  params: {
    slug: string;
    message: string;
    conversationId?: string;
    visitorId?: string;
  },
  callbacks: {
    onEvent: (event: RuntimeEvent) => void;
    onError: (error: Error) => void;
  },
): Promise<AbortController> {
  const controller = new AbortController();
  const url = `${API_BASE_URL.replace(/\/$/, '')}/public/agents/${params.slug}/chat/stream`;

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
      conversationId: params.conversationId,
      visitorId: params.visitorId,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        callbacks.onError(new Error(`请求失败: ${response.status} ${errorText}`));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError(new Error('无法读取响应流'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentData = '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed === '') {
            if (currentData) {
              try {
                const event = JSON.parse(currentData) as RuntimeEvent;
                callbacks.onEvent(event);
              } catch {
                // skip unparseable data
              }
            }
            currentData = '';
            continue;
          }

          if (trimmed.startsWith('data:')) {
            const dataContent = trimmed.slice(5);
            currentData = currentData ? currentData + '\n' + dataContent : dataContent;
          }
        }
      }
    })
    .catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      callbacks.onError(err instanceof Error ? err : new Error('网络请求失败'));
    });

  return controller;
}
