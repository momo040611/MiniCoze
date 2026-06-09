// 增强版 PreviewChat — 支持工具调用卡片、知识库召回卡片、调试信息面板
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Tag } from 'antd'
import {
  PaperClipOutlined, CloseOutlined, LoadingOutlined,
  CheckCircleFilled, CloseCircleFilled, BookOutlined,
} from '@ant-design/icons'
import styles from './PreviewChat.module.css'
import { runAgentStream } from '../../../api/agent-runtime'
import type {
  RuntimeEvent, MessageDeltaEvent, ToolCallCreatedEvent,
  ToolCallCompletedEvent, KnowledgeStatusEvent, RunCompletedEvent,
  TokenUsage,
} from '../../../api/agent-runtime'
import type { IToolCallRecord } from '../../../api/plugins'
import type { OpeningConfig } from '../agent-detail'
import { deleteConversation, getConversation, getConversations } from '../../../api/homepage'
import { formatFileSize } from '../../homepage/utils/format'
import { ToolCallCard, type ToolCallData } from './ToolCallCard'
import { KnowledgeStatus } from './KnowledgeStatus'
import { DebugInfoPanel } from './DebugInfoPanel'

// ---- 消息类型定义 ----

interface BaseMessage {
  id: string
  time: string
  toolCall?: IToolCallRecord
}

interface ChatMessage extends BaseMessage {
  kind: 'message'
  text: string
  sender: 'user' | 'agent'
  status: 'sending' | 'streaming' | 'success' | 'failed'
  errorText?: string
}

interface ToolCallMessage extends BaseMessage {
  kind: 'tool-call'
  toolData: ToolCallData
}

interface KnowledgeRetrievalMessage extends BaseMessage {
  kind: 'knowledge'
  knowledgeEvent: KnowledgeStatusEvent
}

interface DebugMessage extends BaseMessage {
  kind: 'debug'
  runId: string
  model: string
  latency: number
  usage: TokenUsage | null
  toolCalls: ToolCallData[]
}

type PreviewItem = ChatMessage | ToolCallMessage | KnowledgeRetrievalMessage | DebugMessage

// ---- sessionStorage 工具 ----

const STORAGE_PREFIX = 'preview_chat_'

function loadHistory(agentId: string): PreviewItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + agentId)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(agentId: string, items: PreviewItem[]) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + agentId, JSON.stringify(items))
  } catch {
    // ignore
  }
}

// ---- Props ----

interface Props {
  agentId: string
  agentName: string
  avatar: string
  persona: string
  model: string
  temperature: number
  openingConfig: OpeningConfig
  knowledgeBaseId?: string
}

// ---- 主组件 ----

export function PreviewChat({
  agentId, avatar, persona, model, temperature, openingConfig, knowledgeBaseId,
}: Props) {
  const [messages, setMessages] = useState<PreviewItem[]>(() => loadHistory(agentId))
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const sendingRef = useRef(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const toolCallStartRef = useRef<Map<string, number>>(new Map())

  // 调试状态
  const [currentRunId, setCurrentRunId] = useState('')
  const [currentLatency, setCurrentLatency] = useState(0)
  const [currentUsage, setCurrentUsage] = useState<TokenUsage | null>(null)
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallData[]>([])
  const [knowledgeEvent, setKnowledgeEvent] = useState<KnowledgeStatusEvent | null>(null)
  const [knowledgeDismissed, setKnowledgeDismissed] = useState(false)

  const [selectedFile, setSelectedFile] = useState<{ file: File; preview: string; isImage: boolean; size: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 自动滚动
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 组件卸载时中止请求
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // agentId 变化时恢复历史
  useEffect(() => {
    setMessages(loadHistory(agentId))
    setConversationId(null)
    sendingRef.current = false
    setSending(false)
    abortRef.current?.abort()
    abortRef.current = null
    setCurrentToolCalls([])
    setKnowledgeEvent(null)
    setCurrentRunId('')
    setCurrentLatency(0)
    setCurrentUsage(null)
  }, [agentId])

  // 消息变化时持久化
  useEffect(() => {
    if (messages.length > 0) {
      saveHistory(agentId, messages)
    }
  }, [messages, agentId])

  // ---- 发送消息 ----

  const doSend = useCallback((text: string) => {
    if (sendingRef.current) return

    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      kind: 'message',
      text,
      sender: 'user',
      time: timeStr,
      status: 'success',
    }

    const agentMsgId = `agent-${Date.now()}`
    const agentMsg: ChatMessage = {
      id: agentMsgId,
      kind: 'message',
      text: '',
      sender: 'agent',
      time: timeStr,
      status: 'sending',
    }

    const newItems: PreviewItem[] = [userMsg, agentMsg]
    setMessages((prev) => [...prev, ...newItems])
    setInputValue('')
    sendingRef.current = true
    setSending(true)
    setCurrentToolCalls([])
    setKnowledgeEvent(null)
    setKnowledgeDismissed(false)
    toolCallStartRef.current.clear()

    runAgentStream(
      {
        agentId,
        message: text,
        conversationId: conversationId ?? undefined,
        preview: true,
        model: model || undefined,
        systemPrompt: persona || undefined,
        temperature,
        knowledgeBaseId: knowledgeBaseId || undefined,
      },
      {
        onEvent: (event: RuntimeEvent) => {
          switch (event.type) {
            case 'run.created':
              setConversationId(event.conversationId)
              setCurrentRunId(event.runId)
              break

            case 'run.in_progress':
              setMessages((prev) =>
                prev.map((m) =>
                  m.kind === 'message' && m.id === agentMsgId
                    ? { ...m, status: 'streaming' as const }
                    : m
                )
              )
              break

            case 'message.delta':
              setMessages((prev) =>
                prev.map((m) =>
                  m.kind === 'message' && m.id === agentMsgId
                    ? { ...m, text: m.text + (event as MessageDeltaEvent).content, status: 'streaming' as const }
                    : m
                )
              )
              break

            case 'message.completed':
              setMessages((prev) =>
                prev.map((m) =>
                  m.kind === 'message' && m.id === agentMsgId
                    ? { ...m, text: event.content, id: event.messageId, status: 'success' as const }
                    : m
                )
              )
              break

            case 'tool.call.created': {
              const tcEvent = event as ToolCallCreatedEvent
              toolCallStartRef.current.set(tcEvent.toolCallId, performance.now())
              const toolData: ToolCallData = {
                toolCallId: tcEvent.toolCallId,
                name: tcEvent.name,
                args: tcEvent.args,
                status: 'executing',
              }
              setCurrentToolCalls((prev) => [...prev, toolData])
              const toolMsg: ToolCallMessage = {
                id: `tc-${tcEvent.toolCallId}`,
                kind: 'tool-call',
                toolData,
                time: timeStr,
              }
              setMessages((prev) => [...prev, toolMsg])
              break
            }

            case 'tool.call.completed': {
              const tcDone = event as ToolCallCompletedEvent
              const startTime = toolCallStartRef.current.get(tcDone.toolCallId)
              const duration = startTime ? Math.round(performance.now() - startTime) : undefined
              setCurrentToolCalls((prev) =>
                prev.map((tc) =>
                  tc.toolCallId === tcDone.toolCallId
                    ? {
                        ...tc,
                        result: tcDone.result,
                        error: tcDone.error,
                        status: (tcDone.error ? 'failed' : 'success') as ToolCallData['status'],
                        duration,
                      }
                    : tc
                )
              )
              setMessages((prev) =>
                prev.map((m) =>
                  m.kind === 'tool-call' && m.toolData.toolCallId === tcDone.toolCallId
                    ? {
                        ...m,
                        toolData: {
                          ...m.toolData,
                          result: tcDone.result,
                          error: tcDone.error,
                          status: (tcDone.error ? 'failed' : 'success') as ToolCallData['status'],
                          duration,
                        },
                      }
                    : m
                )
              )
              break
            }

            case 'knowledge.status': {
              const ksEvent = event as KnowledgeStatusEvent
              setKnowledgeEvent(ksEvent)
              setKnowledgeDismissed(false)
              const ksMsg: KnowledgeRetrievalMessage = {
                id: `ks-${Date.now()}`,
                kind: 'knowledge',
                knowledgeEvent: ksEvent,
                time: timeStr,
              }
              setMessages((prev) => [...prev, ksMsg])
              break
            }

            case 'run.completed': {
              const rc = event as RunCompletedEvent
              setCurrentLatency(0) // 会在 stream.done 中计算
              if (rc.usage) setCurrentUsage(rc.usage)
              break
            }

            case 'run.failed':
              setMessages((prev) =>
                prev.map((m) =>
                  m.kind === 'message' && m.id === agentMsgId
                    ? { ...m, status: 'failed' as const, errorText: event.error }
                    : m
                )
              )
              sendingRef.current = false
              setSending(false)
              abortRef.current = null
              break

            case 'stream.done':
              // 添加调试信息面板
              if (currentToolCalls.length > 0 || currentRunId) {
                const debugMsg: DebugMessage = {
                  id: `debug-${Date.now()}`,
                  kind: 'debug',
                  runId: currentRunId,
                  model: model || 'unknown',
                  latency: 0,
                  usage: currentUsage,
                  toolCalls: currentToolCalls,
                  time: timeStr,
                }
                setMessages((prev) => [...prev, debugMsg])
              }
              sendingRef.current = false
              setSending(false)
              abortRef.current = null
              break

            default:
              break
          }
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.kind === 'message' && m.id === agentMsgId
                ? { ...m, status: 'failed' as const, errorText: err.message }
                : m
            )
          )
          sendingRef.current = false
          setSending(false)
          abortRef.current = null
        },
      },
    ).then((controller) => {
      abortRef.current = controller
    })
  }, [agentId, conversationId, persona, model, temperature, knowledgeBaseId, currentToolCalls, currentRunId, currentUsage])

  // ---- 清空对话 ----

  const handleClear = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = null
    sendingRef.current = false
    setSending(false)
    setMessages([])
    setInputValue('')
    setCurrentToolCalls([])
    setKnowledgeEvent(null)
    setCurrentRunId('')
    setCurrentLatency(0)
    setCurrentUsage(null)
    const currentConversationId = conversationId
    setConversationId(null)
    if (currentConversationId) {
      await deleteConversation(currentConversationId)
    }
    sessionStorage.removeItem(STORAGE_PREFIX + agentId)
  }, [conversationId, agentId])

  // ---- 发送处理 ----

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text) return
    doSend(text)
    if (selectedFile?.preview) URL.revokeObjectURL(selectedFile.preview)
    setSelectedFile(null)
  }, [inputValue, doSend, selectedFile])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSend()
  }

  // ---- 文件处理 ----

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const preview = isImage ? URL.createObjectURL(file) : ''
    const size = formatFileSize(file.size)
    setSelectedFile({ file, preview, isImage, size })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileRemove = () => {
    if (selectedFile?.preview) URL.revokeObjectURL(selectedFile.preview)
    setSelectedFile(null)
  }

  // ---- 渲染消息状态图标 ----

  function StatusIcon({ status }: { status: ChatMessage['status'] }) {
    switch (status) {
      case 'sending':
        return <LoadingOutlined style={{ fontSize: 12, color: '#6b7280' }} />
      case 'streaming':
        return <LoadingOutlined spin style={{ fontSize: 12, color: '#7c3aed' }} />
      case 'success':
        return <CheckCircleFilled style={{ fontSize: 12, color: '#22c55e' }} />
      case 'failed':
        return <CloseCircleFilled style={{ fontSize: 12, color: '#ef4444' }} />
      default:
        return null
    }
  }

  // ---- 渲染单条消息 ----

  function renderMessage(item: PreviewItem) {
    switch (item.kind) {
      case 'message':
        return renderChatMessage(item)
      case 'tool-call':
        return renderToolCallMessage(item)
      case 'knowledge':
        return renderKnowledgeMessage(item)
      case 'debug':
        return renderDebugMessage(item)
      default:
        return null
    }
  }

  function renderChatMessage(msg: ChatMessage) {
    if (msg.sender === 'user') {
      return (
        <div key={msg.id} className={`${styles.previewBubble} ${styles.previewBubbleUser}`}>
          <div style={{ maxWidth: '80%', minWidth: 0 }}>
            <div className={styles.previewMsg}>{msg.text}</div>
            <div className={styles.previewMeta}>
              <span>{msg.time}</span>
              <StatusIcon status={msg.status} />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div key={msg.id} className={styles.previewBubble}>
        <img src={avatar} alt="" className={styles.previewAvatarSmall} />
        <div style={{ maxWidth: '80%', minWidth: 0, flex: 1 }}>
          <div className={styles.previewMsg}>
            {msg.text || (
              msg.status === 'sending' ? '准备中...' :
              msg.status === 'streaming' ? '思考中...' :
              msg.status === 'failed' ? (msg.errorText || '请求失败') :
              '无法获取回复'
            )}
          </div>
          <div className={styles.previewMeta}>
            <span>{msg.time}</span>
            <StatusIcon status={msg.status} />
            {msg.status === 'failed' && msg.errorText && (
              <span style={{ color: '#ef4444', fontSize: 11 }}>{msg.errorText}</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  function renderToolCallMessage(msg: ToolCallMessage) {
    return (
      <div key={msg.id} style={{ paddingLeft: 38, marginBottom: 4 }}>
        <ToolCallCard data={msg.toolData} />
      </div>
    )
  }

  function renderKnowledgeMessage(msg: KnowledgeRetrievalMessage) {
    const info = msg.knowledgeEvent.knowledge
    return (
      <div key={msg.id} style={{ paddingLeft: 38, marginBottom: 4 }}>
        <KnowledgeStatus
          knowledgeEvent={msg.knowledgeEvent}
          onClose={() => setKnowledgeDismissed(true)}
        />
      </div>
    )
  }

  function renderDebugMessage(msg: DebugMessage) {
    return (
      <div key={msg.id} style={{ paddingLeft: 38, marginBottom: 4 }}>
        <DebugInfoPanel
          runId={msg.runId}
          model={msg.model}
          latency={msg.latency}
          usage={msg.usage}
          toolCalls={msg.toolCalls}
        />
      </div>
    )
  }

  // ---- 未绑定知识库提示 ----

  const showKnowledgeHint = !knowledgeBaseId && !knowledgeEvent

  return (
    <div className={styles.previewBox}>
      {/* 工具栏 */}
      <div className={styles.previewToolbar}>
        <span className={styles.previewToolbarText}>预览与调试</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {model && (
            <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>{model}</Tag>
          )}
          <button
            className={styles.previewClearBtn}
            type="button"
            onClick={handleClear}
            disabled={messages.length === 0 && !conversationId}
          >
            清除
          </button>
        </div>
      </div>

      {/* 知识库未绑定提示 */}
      {showKnowledgeHint && (
        <div style={{
          padding: '8px 14px', background: '#fffbeb', borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#92400e',
        }}>
          <BookOutlined style={{ color: '#f59e0b' }} />
          未绑定知识库，调试时无法进行知识召回。请在编排配置中绑定知识库。
        </div>
      )}

      {/* 消息区域 */}
      <div className={styles.previewChat}>
        {/* 开场白 */}
        {openingConfig.openingMessage && messages.length === 0 && (
          <div className={styles.previewBubble}>
            <img src={avatar} alt="" className={styles.previewAvatarSmall} />
            <div>
              <div className={styles.previewMsg}>{openingConfig.openingMessage}</div>
            </div>
          </div>
        )}

        {/* 开场问题 */}
        {openingConfig.openingQuestionsEnabled &&
          (openingConfig.openingQuestions?.length ?? 0) > 0 &&
          messages.length === 0 && (
            <div className={styles.openingQuestions}>
              {(openingConfig.openingQuestions ?? []).map((q, i) => (
                <span
                  key={i}
                  onClick={() => doSend(q)}
                  style={{
                    padding: '4px 12px', borderRadius: 14,
                    border: '1px solid rgba(104,119,144,0.15)',
                    fontSize: 12, color: '#506070', cursor: 'pointer', background: '#fff',
                  }}
                >{q}</span>
              ))}
            </div>
          )}

        {/* 消息列表 */}
        {messages.map((msg) => renderMessage(msg))}
        <div ref={chatEndRef} />
      </div>

      {/* 文件预览栏 */}
      {selectedFile && (
        <div className={styles.filePreviewBar}>
          {selectedFile.isImage ? (
            <img src={selectedFile.preview} alt={selectedFile.file.name} className={styles.filePreviewThumb} />
          ) : (
            <span className={styles.previewDocIcon}>📄</span>
          )}
          <div className={styles.filePreviewInfo}>
            <span className={styles.filePreviewName}>{selectedFile.file.name}</span>
            <span className={styles.filePreviewSize}>{selectedFile.size}</span>
          </div>
          <Button
            icon={<CloseOutlined />}
            size="small"
            type="text"
            danger
            onClick={handleFileRemove}
            aria-label="删除文件"
          />
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpg,image/jpeg,image/gif,image/webp,.pdf,.doc,.docx,.txt,.xlsx,.pptx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 输入栏 */}
      <div className={styles.previewInputRow}>
        <Button
          icon={<PaperClipOutlined />}
          type="text"
          onClick={() => fileInputRef.current?.click()}
          aria-label="文件上传"
          className={styles.previewAttachBtn}
        />
        <input
          className={styles.previewInput}
          placeholder="输入消息调试智能体..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className={styles.previewSendBtn}
          onClick={handleSend}
          disabled={sending}
          style={{ opacity: sending ? 0.5 : 1, cursor: sending ? 'not-allowed' : 'pointer' }}
        >
          {sending ? '等待...' : '发送'}
        </button>
      </div>
    </div>
  )
}
