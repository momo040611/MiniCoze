import { useCallback, useEffect, useRef, useState } from 'react';
import {
  runAgentStream,
  type KnowledgeStatusEvent,
  type RuntimeEvent,
  type TokenUsage,
  type ToolCallCompletedEvent,
  type ToolCallCreatedEvent,
  type ToolCallFailedEvent,
} from '../../../api/agent-runtime';
import { deleteConversation, getConversation } from '../../../api/homepage';
import type { ToolCallData } from '../../agent-config/components/ToolCallCard';
import { mapConversationMessages } from '../mappers';
import type { ChatAttachment, ChatItem, ChatMessage, DebugMessage } from '../types';

interface UseAgentChatOptions {
  agentId: string | null;
  preview: boolean;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  knowledgeBaseId?: string;
  agentName?: string;
  agentIcon?: string;
  appendKnowledgeItems?: boolean;
  appendDebugItems?: boolean;
  appendErrorItems?: boolean;
  onRunFinished?: () => void;
}

interface SendMessageInput {
  content: string;
  displayContent?: string;
  attachments?: ChatAttachment[];
}

function createTime() {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function useAgentChat(options: UseAgentChatOptions) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [conversationId, setConversationIdState] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [currentRunId, setCurrentRunId] = useState('');
  const [currentLatency, setCurrentLatency] = useState(0);
  const [currentUsage, setCurrentUsage] = useState<TokenUsage | null>(null);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallData[]>([]);
  const [knowledgeEvent, setKnowledgeEvent] = useState<KnowledgeStatusEvent | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const toolStartRef = useRef(new Map<string, number>());
  const runStartRef = useRef(0);
  const runIdRef = useRef('');
  const usageRef = useRef<TokenUsage | null>(null);
  const toolCallsRef = useRef<ToolCallData[]>([]);
  const contentRef = useRef('');
  const flushFrameRef = useRef(0);

  const setConversationId = useCallback((value: string | null) => {
    conversationIdRef.current = value;
    setConversationIdState(value);
  }, []);

  const updateToolCalls = useCallback((updater: (items: ToolCallData[]) => ToolCallData[]) => {
    setCurrentToolCalls((current) => {
      const next = updater(current);
      toolCallsRef.current = next;
      return next;
    });
  }, []);

  const finishRun = useCallback(() => {
    sendingRef.current = false;
    setSending(false);
    abortRef.current = null;
    toolStartRef.current.clear();
    options.onRunFinished?.();
  }, [options.onRunFinished]);

  const resetRuntimeState = useCallback(() => {
    if (flushFrameRef.current) cancelAnimationFrame(flushFrameRef.current);
    flushFrameRef.current = 0;
    setCurrentRunId('');
    setCurrentLatency(0);
    setCurrentUsage(null);
    setCurrentToolCalls([]);
    setKnowledgeEvent(null);
    runIdRef.current = '';
    usageRef.current = null;
    toolCallsRef.current = [];
    contentRef.current = '';
    toolStartRef.current.clear();
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (flushFrameRef.current) cancelAnimationFrame(flushFrameRef.current);
    flushFrameRef.current = 0;
    sendingRef.current = false;
    setSending(false);
    toolStartRef.current.clear();
    setItems((current) => current.map((item) =>
      item.kind === 'message' && item.status === 'streaming'
        ? { ...item, status: 'success' }
        : item,
    ));
    options.onRunFinished?.();
  }, [options.onRunFinished]);

  const replaceSession = useCallback((nextConversationId: string | null, nextItems: ChatItem[]) => {
    stop();
    setConversationId(nextConversationId);
    setItems(nextItems);
    resetRuntimeState();
  }, [resetRuntimeState, setConversationId, stop]);

  const startNewConversation = useCallback(() => {
    replaceSession(null, []);
  }, [replaceSession]);

  const loadConversation = useCallback(async (id: string) => {
    const detail = await getConversation(id);
    if (!detail) throw new Error('对话不存在');
    if (options.agentId && detail.agentId !== options.agentId) {
      throw new Error('对话不属于当前智能体');
    }
    if (detail.isPreview !== undefined && detail.isPreview !== options.preview) {
      throw new Error('对话类型不匹配');
    }

    replaceSession(id, mapConversationMessages(detail));
    return detail;
  }, [options.agentId, options.preview, replaceSession]);

  const deleteCurrentConversation = useCallback(async () => {
    const id = conversationIdRef.current;
    startNewConversation();
    if (id) await deleteConversation(id);
  }, [startNewConversation]);

  const sendMessage = useCallback(async ({
    content,
    displayContent = content,
    attachments = [],
  }: SendMessageInput) => {
    const normalized = content.trim();
    if (!normalized || !options.agentId || sendingRef.current) return false;

    const time = createTime();
    const agentMessageId = `agent-${Date.now()}`;
    const userMessage: ChatMessage = {
      kind: 'message',
      id: `user-${Date.now()}`,
      text: displayContent,
      sender: 'user',
      time,
      status: 'success',
      attachments,
    };
    const agentMessage: ChatMessage = {
      kind: 'message',
      id: agentMessageId,
      text: '',
      sender: 'agent',
      time,
      status: 'sending',
      attachments: [],
      agentName: options.agentName,
      agentIcon: options.agentIcon,
    };

    setItems((current) => [...current, userMessage, agentMessage]);
    resetRuntimeState();
    sendingRef.current = true;
    setSending(true);
    runStartRef.current = performance.now();

    try {
      const controller = await runAgentStream(
        {
          agentId: options.agentId,
          message: normalized,
          conversationId: conversationIdRef.current ?? undefined,
          preview: options.preview,
          model: options.model || undefined,
          systemPrompt: options.systemPrompt || undefined,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          knowledgeBaseId: options.knowledgeBaseId || undefined,
          attachments: attachments.map(({ fileId, name, mimeType, size }) => ({
            fileId,
            name,
            mimeType,
            size,
          })),
        },
        {
          onEvent: (event: RuntimeEvent) => {
            switch (event.type) {
              case 'run.created':
                runIdRef.current = event.runId;
                setCurrentRunId(event.runId);
                if (!conversationIdRef.current) setConversationId(event.conversationId);
                break;
              case 'run.in_progress':
                setItems((current) => current.map((item) =>
                  item.kind === 'message' && item.id === agentMessageId
                    ? { ...item, status: 'streaming' }
                    : item,
                ));
                break;
              case 'message.delta':
                contentRef.current += event.content;
                if (flushFrameRef.current) cancelAnimationFrame(flushFrameRef.current);
                flushFrameRef.current = requestAnimationFrame(() => {
                  const text = contentRef.current;
                  setItems((current) => current.map((item) =>
                    item.kind === 'message' && item.id === agentMessageId
                      ? { ...item, text, status: 'streaming', messageId: event.messageId }
                      : item,
                  ));
                });
                break;
              case 'message.completed':
                if (flushFrameRef.current) cancelAnimationFrame(flushFrameRef.current);
                flushFrameRef.current = 0;
                setItems((current) => current.map((item) =>
                  item.kind === 'message' && item.id === agentMessageId
                    ? { ...item, id: event.messageId, messageId: event.messageId, text: event.content, status: 'success' }
                    : item,
                ));
                break;
              case 'tool.call.created': {
                const toolEvent = event as ToolCallCreatedEvent;
                toolStartRef.current.set(toolEvent.toolCallId, performance.now());
                const toolData: ToolCallData = {
                  toolCallId: toolEvent.toolCallId,
                  name: toolEvent.name,
                  args: toolEvent.args,
                  status: 'executing',
                };
                updateToolCalls((current) => [...current, toolData]);
                setItems((current) => [...current, {
                  kind: 'tool-call',
                  id: `tool-${toolEvent.toolCallId}`,
                  toolData,
                  time,
                }]);
                break;
              }
              case 'tool.call.completed': {
                const toolEvent = event as ToolCallCompletedEvent;
                const startedAt = toolStartRef.current.get(toolEvent.toolCallId);
                const duration = startedAt ? Math.round(performance.now() - startedAt) : undefined;
                toolStartRef.current.delete(toolEvent.toolCallId);
                const patch = {
                  status: toolEvent.error ? 'failed' as const : 'success' as const,
                  result: toolEvent.result,
                  error: toolEvent.error,
                  duration,
                };
                updateToolCalls((current) => current.map((item) =>
                  item.toolCallId === toolEvent.toolCallId ? { ...item, ...patch } : item,
                ));
                setItems((current) => current.map((item) =>
                  item.kind === 'tool-call' && item.toolData.toolCallId === toolEvent.toolCallId
                    ? { ...item, toolData: { ...item.toolData, ...patch } }
                    : item,
                ));
                break;
              }
              case 'tool.call.failed': {
                const toolEvent = event as ToolCallFailedEvent;
                const startedAt = toolStartRef.current.get(toolEvent.toolCallId);
                const duration = startedAt ? Math.round(performance.now() - startedAt) : undefined;
                toolStartRef.current.delete(toolEvent.toolCallId);
                const patch = { status: 'failed' as const, error: toolEvent.error, duration };
                updateToolCalls((current) => current.map((item) =>
                  item.toolCallId === toolEvent.toolCallId ? { ...item, ...patch } : item,
                ));
                setItems((current) => current.map((item) =>
                  item.kind === 'tool-call' && item.toolData.toolCallId === toolEvent.toolCallId
                    ? { ...item, toolData: { ...item.toolData, ...patch } }
                    : item,
                ));
                break;
              }
              case 'knowledge.status': {
                const knowledge = event as KnowledgeStatusEvent;
                setKnowledgeEvent(knowledge);
                if (options.appendKnowledgeItems) {
                  setItems((current) => [...current, {
                    kind: 'knowledge',
                    id: `knowledge-${Date.now()}`,
                    knowledgeEvent: knowledge,
                    time,
                  }]);
                }
                break;
              }
              case 'run.completed':
                usageRef.current = event.usage ?? null;
                setCurrentUsage(event.usage ?? null);
                setCurrentLatency(Math.round(performance.now() - runStartRef.current));
                finishRun();
                break;
              case 'run.failed':
                setItems((current) => {
                  const failed = current.map((item) =>
                    item.kind === 'message' && item.id === agentMessageId
                      ? { ...item, status: 'failed' as const, errorText: event.error }
                      : item,
                  );
                  return options.appendErrorItems
                    ? [...failed, {
                        kind: 'error' as const,
                        id: `error-${Date.now()}`,
                        errorText: `运行失败: ${event.error}`,
                        retryText: displayContent,
                      }]
                    : failed;
                });
                finishRun();
                break;
              case 'stream.done':
                if (options.appendDebugItems && runIdRef.current) {
                  const debugItem: DebugMessage = {
                    kind: 'debug',
                    id: `debug-${Date.now()}`,
                    runId: runIdRef.current,
                    model: options.model || 'unknown',
                    latency: Math.round(performance.now() - runStartRef.current),
                    usage: usageRef.current,
                    toolCalls: toolCallsRef.current,
                    time,
                  };
                  setItems((current) => [...current, debugItem]);
                }
                if (sendingRef.current) finishRun();
                break;
            }
          },
          onError: (error) => {
            setItems((current) => {
              const failed = current.map((item) =>
                item.kind === 'message' && item.id === agentMessageId
                  ? { ...item, status: 'failed' as const, errorText: error.message }
                  : item,
              );
              return options.appendErrorItems
                ? [...failed, {
                    kind: 'error' as const,
                    id: `error-${Date.now()}`,
                    errorText: `发送消息失败: ${error.message}`,
                    retryText: displayContent,
                  }]
                : failed;
            });
            finishRun();
          },
        },
      );
      abortRef.current = controller;
      return true;
    } catch (error) {
      finishRun();
      throw error;
    }
  }, [finishRun, options, resetRuntimeState, setConversationId, updateToolCalls]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (flushFrameRef.current) cancelAnimationFrame(flushFrameRef.current);
  }, []);

  return {
    items,
    setItems,
    conversationId,
    setConversationId,
    sending,
    currentRunId,
    currentLatency,
    currentUsage,
    currentToolCalls,
    knowledgeEvent,
    sendMessage,
    stop,
    loadConversation,
    replaceSession,
    startNewConversation,
    deleteCurrentConversation,
    resetRuntimeState,
  };
}
