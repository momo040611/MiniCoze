

import { API_BASE_URL, getAuthToken } from '../http';
import { runAgentStreamMock } from './mock-stream';

const useMock = import.meta.env.VITE_USE_AUTH_MOCK === 'true';



export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type RuntimeEventType =
  | 'run.created'
  | 'run.in_progress'
  | 'message.delta'
  | 'message.completed'
  | 'tool.call.created'
  | 'tool.call.completed'
  | 'knowledge.status'
  | 'workflow.step'
  | 'run.completed'
  | 'run.failed'
  | 'stream.done';

export interface RunCreatedEvent {
  type: 'run.created';
  runId: string;
  conversationId: string;
}

export interface RunInProgressEvent {
  type: 'run.in_progress';
  runId: string;
}

export interface RetrievalChunk {
  id: string;
  content: string;
  score: number;
  documentName: string;
}

export type KnowledgeBoundStatus =
  | { bound: false }
  | { bound: true; knowledgeName: string; retrievedCount?: number; chunks?: RetrievalChunk[] };

export interface KnowledgeStatusEvent {
  type: 'knowledge.status';
  runId: string;
  knowledge: KnowledgeBoundStatus;
}

export interface MessageDeltaEvent {
  type: 'message.delta';
  runId: string;
  messageId: string;
  content: string;
}

export interface MessageCompletedEvent {
  type: 'message.completed';
  runId: string;
  messageId: string;
  content: string;
}

export interface ToolCallCreatedEvent {
  type: 'tool.call.created';
  runId: string;
  toolCallId: string;
  name: string;
  args: unknown;
}

export interface ToolCallCompletedEvent {
  type: 'tool.call.completed';
  runId: string;
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

export interface RunCompletedEvent {
  type: 'run.completed';
  runId: string;
  usage?: TokenUsage;
}

export interface RunFailedEvent {
  type: 'run.failed';
  runId: string;
  error: string;
}

export interface StreamDoneEvent {
  type: 'stream.done';
  runId: string;
}

export interface WorkflowStepEvent {
  type: 'workflow.step';
  runId: string;
  workflowId: string;
  workflowName: string;
  stepId: string;
  stepName: string;
  stepType: string;
  status: 'running' | 'success' | 'failed' | 'skipped';
  input?: unknown;
  output?: unknown;
  error?: string;
  duration?: number;
}

export type RuntimeEvent =
  | RunCreatedEvent
  | RunInProgressEvent
  | KnowledgeStatusEvent
  | MessageDeltaEvent
  | MessageCompletedEvent
  | ToolCallCreatedEvent
  | ToolCallCompletedEvent
  | WorkflowStepEvent
  | RunCompletedEvent
  | RunFailedEvent
  | StreamDoneEvent;



export interface RunAgentParams {
  agentId: string;
  message: string;
  conversationId?: string;
  preview?: boolean;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  knowledgeBaseId?: string;
  timeout?: number;
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
}



export interface RunAgentCallbacks {
  onEvent: (event: RuntimeEvent) => void;
  onError: (error: Error) => void;
}



export async function runAgentStream(
  params: RunAgentParams,
  callbacks: RunAgentCallbacks,
): Promise<AbortController> {
  // Mock 模式下使用模拟流
  if (useMock) {
    return runAgentStreamMock(params, callbacks);
  }

  const token = getAuthToken();
  const controller = new AbortController();

  const url = `${API_BASE_URL.replace(/\/$/, '')}/agent-runs/stream`;

  // 超时保护：默认 120 秒
  const timeoutMs = params.timeout ?? 120_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      agentId: params.agentId,
      message: params.message,
      conversationId: params.conversationId,
      preview: params.preview,
      model: params.model,
      systemPrompt: params.systemPrompt,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      knowledgeBaseId: params.knowledgeBaseId,
      tools: params.tools,
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
      let currentEventType = '';
      let currentData = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          // 空行表示事件结束，处理累积的数据
          if (trimmed === '') {
            if (currentData) {
              try {
                const parsed = JSON.parse(currentData);
                // 如果 JSON 中没有 type 字段，使用 SSE event: 行作为 fallback
                if (!parsed.type && currentEventType) {
                  parsed.type = currentEventType;
                }
                callbacks.onEvent(parsed as RuntimeEvent);
              } catch {
                console.warn('[agent-runtime] 无法解析 SSE 数据:', currentData.slice(0, 200));
              }
            }
            currentEventType = '';
            currentData = '';
            continue;
          }

          // 注释行（以 : 开头），跳过
          if (trimmed.startsWith(':')) {
            continue;
          }

          // 解析 event 类型
          if (trimmed.startsWith('event:')) {
            currentEventType = trimmed.slice(6).trim();
            continue;
          }

          // 累积 data 字段（支持多行 data）
          if (trimmed.startsWith('data:')) {
            const dataContent = trimmed.slice(5);
            currentData = currentData ? currentData + '\n' + dataContent : dataContent;
            continue;
          }

          // 标准 SSE 字段：id、retry（当前暂存不处理，确保不干扰 data 解析）
          if (trimmed.startsWith('id:') || trimmed.startsWith('retry:')) {
            continue;
          }
        }
      }
    })
    .catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      callbacks.onError(err instanceof Error ? err : new Error('网络请求失败'));
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  return controller;
}
