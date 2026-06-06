import { useCallback, useRef, useState } from 'react';
import { runAgentStream } from '../../../api/agent-runtime';
import type {
  RuntimeEvent,
  TokenUsage,
  ToolCallCreatedEvent,
  ToolCallCompletedEvent,
  KnowledgeStatusEvent,
} from '../../../api/agent-runtime';
import type { ToolCallData } from '../../agent-config/components/ToolCallCard';

interface ChatMessage {
  kind: 'message';
  id: string;
  text: string;
  sender: 'user' | 'agent';
  time: string;
  status: 'sending' | 'streaming' | 'success' | 'failed';
  agentName?: string;
  agentIcon?: string;
  messageId?: string;
  fileName?: string;
  filePreview?: string;
  fileIsImage?: boolean;
}

interface ToolCallMessage {
  kind: 'tool-call';
  id: string;
  toolData: ToolCallData;
}

interface ErrorMessage {
  kind: 'error';
  id: string;
  errorText: string;
  retryText: string;
}

type ChatItem = ChatMessage | ToolCallMessage | ErrorMessage;

interface SendMessageParams {
  agentId: string;
  message: string;
  conversationId?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  knowledgeBaseId?: string;
  tools?: Array<{ type: 'function'; function: { name: string; description: string } }>;
  agentName?: string;
  agentIcon?: string;
  fileName?: string;
  filePreview?: string;
  fileIsImage?: boolean;
}

interface UseChatStreamReturn {
  sending: boolean;
  currentRunId: string;
  currentLatency: number;
  currentUsage: TokenUsage | null;
  currentToolCalls: ToolCallData[];
  knowledgeEvent: { type: string; runId: string; knowledge: { bound: boolean; knowledgeName?: string; retrievedCount?: number } } | null;
  knowledgeDismissed: boolean;
  setKnowledgeDismissed: (dismissed: boolean) => void;
  sendMessage: (params: SendMessageParams) => Promise<ChatItem[]>;
  stopGeneration: () => void;
  resetDebugState: () => void;
}

export function useChatStream(): UseChatStreamReturn {
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const runStartRef = useRef(0);
  const lastContentRef = useRef('');
  const toolCallStartRef = useRef<Map<string, number>>(new Map());

  // 流式输出渲染节流
  const flushRafRef = useRef(0);
  const pendingTextRef = useRef('');
  const pendingAgentMsgIdRef = useRef('');
  const pendingMessageIdRef = useRef('');

  const [currentRunId, setCurrentRunId] = useState('');
  const [currentLatency, setCurrentLatency] = useState(0);
  const [currentUsage, setCurrentUsage] = useState<TokenUsage | null>(null);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallData[]>([]);
  const [knowledgeEvent, setKnowledgeEvent] = useState<{ type: string; runId: string; knowledge: { bound: boolean; knowledgeName?: string; retrievedCount?: number } } | null>(null);
  const [knowledgeDismissed, setKnowledgeDismissed] = useState(false);

  const resetDebugState = useCallback(() => {
    setCurrentRunId('');
    setCurrentLatency(0);
    setCurrentUsage(null);
    setCurrentToolCalls([]);
    setKnowledgeEvent(null);
    setKnowledgeDismissed(false);
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setSending(false);
    sendingRef.current = false;
    toolCallStartRef.current.clear();
  }, []);

  const sendMessage = useCallback(async (params: SendMessageParams): Promise<ChatItem[]> => {
    const {
      agentId,
      message,
      conversationId,
      systemPrompt,
      model,
      temperature,
      maxTokens = 4096,
      knowledgeBaseId,
      tools,
      agentName,
      agentIcon,
      fileName,
      filePreview,
      fileIsImage,
    } = params;

    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const userMsg: ChatMessage = {
      kind: 'message',
      id: `user-${Date.now()}`,
      text: message,
      time: timestamp,
      sender: 'user',
      status: 'success',
      agentName,
      fileName,
      filePreview,
      fileIsImage,
    };

    const agentMsgId = `agent-${Date.now()}`;
    const agentMsg: ChatMessage = {
      kind: 'message',
      id: agentMsgId,
      text: '',
      time: timestamp,
      sender: 'agent',
      status: 'sending',
      agentName,
      agentIcon,
    };

    setSending(true);
    sendingRef.current = true;
    lastContentRef.current = '';
    runStartRef.current = performance.now();
    resetDebugState();

    const newMessages: ChatItem[] = [userMsg, agentMsg];

    const abortController = await runAgentStream(
      {
        agentId,
        message,
        conversationId,
        systemPrompt,
        model,
        temperature,
        maxTokens,
        knowledgeBaseId,
        tools,
      },
      {
        onEvent: (event: RuntimeEvent) => {
          switch (event.type) {
            case 'run.created':
              setCurrentRunId(event.runId);
              break;

            case 'knowledge.status': {
              const ksEvent = event as KnowledgeStatusEvent;
              setKnowledgeEvent({
                type: ksEvent.type,
                runId: ksEvent.runId,
                knowledge: ksEvent.knowledge,
              });
              setKnowledgeDismissed(false);
              break;
            }

            case 'message.delta': {
              lastContentRef.current += event.content;
              pendingTextRef.current = lastContentRef.current;
              pendingAgentMsgIdRef.current = agentMsgId;
              pendingMessageIdRef.current = event.messageId;

              if (flushRafRef.current) cancelAnimationFrame(flushRafRef.current);
              flushRafRef.current = requestAnimationFrame(() => {
                // 更新消息状态
                const msgIndex = newMessages.findIndex(
                  (m) => m.kind === 'message' && m.id === pendingAgentMsgIdRef.current
                );
                if (msgIndex !== -1) {
                  const msg = newMessages[msgIndex] as ChatMessage;
                  newMessages[msgIndex] = {
                    ...msg,
                    text: pendingTextRef.current,
                    status: 'streaming',
                    messageId: pendingMessageIdRef.current,
                  };
                }
              });
              break;
            }

            case 'message.completed': {
              const msgIndex = newMessages.findIndex(
                (m) => m.kind === 'message' && m.id === agentMsgId
              );
              if (msgIndex !== -1) {
                newMessages[msgIndex] = {
                  kind: 'message',
                  id: event.messageId,
                  text: event.content,
                  sender: 'agent',
                  time: timestamp,
                  status: 'success',
                  agentName,
                  agentIcon,
                  messageId: event.messageId,
                };
              }
              break;
            }

            case 'tool.call.created': {
              const tcEvent = event as ToolCallCreatedEvent;
              toolCallStartRef.current.set(tcEvent.toolCallId, performance.now());
              const newToolCall: ToolCallData = {
                toolCallId: tcEvent.toolCallId,
                name: tcEvent.name,
                args: tcEvent.args,
                status: 'executing',
              };
              setCurrentToolCalls((prev) => [...prev, newToolCall]);
              newMessages.push({
                kind: 'tool-call',
                id: `tool-${tcEvent.toolCallId}`,
                toolData: newToolCall,
              });
              break;
            }

            case 'tool.call.completed': {
              const tcCompleteEvent = event as ToolCallCompletedEvent & { error?: string };
              const startTime = toolCallStartRef.current.get(tcCompleteEvent.toolCallId);
              const duration = startTime ? Math.round(performance.now() - startTime) : undefined;
              toolCallStartRef.current.delete(tcCompleteEvent.toolCallId);
              const isFailed = !!tcCompleteEvent.error;

              setCurrentToolCalls((prev) =>
                prev.map((tc) =>
                  tc.toolCallId === tcCompleteEvent.toolCallId
                    ? { ...tc, status: isFailed ? 'failed' : 'success', result: tcCompleteEvent.result, error: tcCompleteEvent.error, duration }
                    : tc
                )
              );

              const toolMsgIndex = newMessages.findIndex(
                (m) => m.kind === 'tool-call' && m.id === `tool-${tcCompleteEvent.toolCallId}`
              );
              if (toolMsgIndex !== -1) {
                const toolMsg = newMessages[toolMsgIndex] as ToolCallMessage;
                newMessages[toolMsgIndex] = {
                  ...toolMsg,
                  toolData: {
                    ...toolMsg.toolData,
                    status: isFailed ? 'failed' : 'success',
                    result: tcCompleteEvent.result,
                    error: tcCompleteEvent.error,
                    duration,
                  },
                };
              }
              break;
            }

            case 'run.completed':
              setCurrentUsage(event.usage ?? null);
              setCurrentLatency(Math.round(performance.now() - runStartRef.current));
              setSending(false);
              sendingRef.current = false;
              abortRef.current = null;
              toolCallStartRef.current.clear();
              break;

            case 'stream.done':
              if (sendingRef.current) {
                setSending(false);
                sendingRef.current = false;
                abortRef.current = null;
                toolCallStartRef.current.clear();
              }
              break;

            case 'run.failed': {
              const errMsg: ErrorMessage = {
                kind: 'error',
                id: `err-${Date.now()}`,
                errorText: `运行失败: ${event.error}`,
                retryText: message,
              };
              newMessages.push(errMsg);
              setSending(false);
              sendingRef.current = false;
              abortRef.current = null;
              break;
            }

            case 'run.in_progress':
              break;

            default:
              break;
          }
        },
        onError: (err) => {
          console.error(err);
          const errMsg: ErrorMessage = {
            kind: 'error',
            id: `err-${Date.now()}`,
            errorText: `发送消息失败: ${err.message}`,
            retryText: message,
          };
          newMessages.push(errMsg);
          setSending(false);
          sendingRef.current = false;
          abortRef.current = null;
        },
      },
    );

    abortRef.current = abortController;
    return newMessages;
  }, [resetDebugState]);

  return {
    sending,
    currentRunId,
    currentLatency,
    currentUsage,
    currentToolCalls,
    knowledgeEvent,
    knowledgeDismissed,
    setKnowledgeDismissed,
    sendMessage,
    stopGeneration,
    resetDebugState,
  };
}
