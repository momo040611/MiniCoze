import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from 'antd'
import { PaperClipOutlined, CloseOutlined } from '@ant-design/icons'
import styles from './PreviewChat.module.css'
import { runAgentStream } from '../../../api/agent-runtime'
import type { RuntimeEvent, MessageDeltaEvent } from '../../../api/agent-runtime'
import type { IToolCallRecord } from '../../../api/plugins'
import type { OpeningConfig } from '../agent-detail'
import { deleteConversation, getConversation, getConversations } from '../../../api/homepage'
import { formatFileSize } from '../../homepage/utils/format'
import { ToolCallCard } from '../../plugins/components/ToolCallCard'

interface ChatMessage {
  id: string
  text: string
  sender: 'user' | 'agent'
  time: string
  toolCall?: IToolCallRecord
}

interface Props {
  agentId: string
  agentName: string
  avatar: string
  persona: string
  model: string
  temperature: number
  openingConfig: OpeningConfig
  /** 智能体是否已发布，DRAFT 状态下不可运行 */
  isPublished?: boolean
}

export function PreviewChat({ agentId, avatar, persona, model, temperature, openingConfig, isPublished }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const sendingRef = useRef(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ file: File; preview: string; isImage: boolean; size: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (selectedFile?.preview) {
        URL.revokeObjectURL(selectedFile.preview)
      }
    }
  }, [selectedFile])

  useEffect(() => {
    let active = true

    setMessages([])
    setConversationId(null)
    sendingRef.current = false
    setSending(false)
    abortRef.current?.abort()
    abortRef.current = null

    getConversations(agentId, { preview: true })
      .then(async (list) => {
        const latest = list[0]
        if (!active || !latest) return

        const detail = await getConversation(latest.id)
        if (!active || !detail) return

        setConversationId(detail.id)
        setMessages(
          detail.messages
            .filter((message) => message.role === 'USER' || message.role === 'ASSISTANT')
            .map((message) => ({
              id: message.id,
              text: message.content,
              sender: message.role === 'USER' ? 'user' : 'agent',
              time: new Date(message.createdAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })),
        )
      })
      .catch(() => {
        if (active) {
          setMessages([])
          setConversationId(null)
        }
      })

    return () => {
      active = false
    }
  }, [agentId])

  const doSend = useCallback((text: string) => {
    if (sendingRef.current) return

    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      text,
      sender: 'user',
      time: timeStr,
    }

    const agentMsgId = `agent-${Date.now()}`
    const agentMsg: ChatMessage = {
      id: agentMsgId,
      text: '',
      sender: 'agent',
      time: timeStr,
    }

    setMessages((prev) => [...prev, userMsg, agentMsg])
    setInputValue('')
    sendingRef.current = true
    setSending(true)

    runAgentStream(
      {
        agentId,
        message: text,
        conversationId: conversationId ?? undefined,
        preview: true,
        model: model || undefined,
        systemPrompt: persona || undefined,
        temperature,
      },
      {
        onEvent: (event: RuntimeEvent) => {
          switch (event.type) {
            case 'run.created':
              setConversationId(event.conversationId)
              break

            case 'message.delta':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, text: m.text + (event as MessageDeltaEvent).content } : m
                )
              )
              break

            case 'message.completed':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? { ...m, text: event.content, id: event.messageId }
                    : m
                )
              )
              sendingRef.current = false
              setSending(false)
              abortRef.current = null
              break

            case 'run.completed':
            case 'stream.done':
              sendingRef.current = false
              setSending(false)
              abortRef.current = null
              break

            case 'run.failed':
              sendingRef.current = false
              setSending(false)
              abortRef.current = null
              break

            case 'run.in_progress':
              break

            case 'tool.call.created': {
              const params = event.args && typeof event.args === 'object' && !Array.isArray(event.args)
                ? event.args as Record<string, unknown>
                : { value: event.args }
              setMessages((prev) => [
                ...prev,
                {
                  id: `tool-${event.toolCallId}`,
                  text: '',
                  sender: 'agent',
                  time: timeStr,
                  toolCall: {
                    callId: event.toolCallId,
                    toolName: event.name,
                    params,
                    status: 'running',
                    startedAt: new Date().toISOString(),
                  },
                },
              ])
              break
            }

            case 'tool.call.completed':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === `tool-${event.toolCallId}` && m.toolCall
                    ? {
                        ...m,
                        toolCall: {
                          ...m.toolCall,
                          toolName: event.name,
                          status: 'success',
                          result: event.result,
                          finishedAt: new Date().toISOString(),
                        },
                      }
                    : m
                )
              )
              break

            default:
              break
          }
        },
        onError: () => {
          sendingRef.current = false
          setSending(false)
          abortRef.current = null
        },
      },
    ).then((controller) => {
      abortRef.current = controller
    })
  }, [agentId, conversationId, persona, model, temperature])

  const handleClear = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = null
    sendingRef.current = false
    setSending(false)
    setMessages([])
    setInputValue('')

    const currentConversationId = conversationId
    setConversationId(null)

    if (currentConversationId) {
      await deleteConversation(currentConversationId)
    }
  }, [conversationId])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text) return
    doSend(text)
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview)
    }
    setSelectedFile(null)
  }, [inputValue, doSend, selectedFile])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')
    const preview = isImage ? URL.createObjectURL(file) : ''
    const size = formatFileSize(file.size)

    setSelectedFile({ file, preview, isImage, size })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileRemove = () => {
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview)
    }
    setSelectedFile(null)
  }

  const draftPlaceholder = (
    <div className={styles.previewChat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#8899aa' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div style={{ fontSize: 14, marginBottom: 4 }}>智能体尚未发布</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>请先保存并发布智能体后再进行预览调试</div>
      </div>
    </div>
  )

  return (
    <div className={styles.previewBox}>
      <div className={styles.previewToolbar}>
        <span className={styles.previewToolbarText}>预览会话</span>
        <button
          className={styles.previewClearBtn}
          type="button"
          onClick={handleClear}
          disabled={messages.length === 0 && !conversationId}
        >
          清除
        </button>
      </div>
      {isPublished === false ? (
        draftPlaceholder
      ) : (
        <div className={styles.previewChat}>
          {openingConfig.openingMessage && messages.length === 0 && (
            <div className={styles.previewBubble}>
              <img src={avatar} alt="" className={styles.previewAvatarSmall} />
              <div>
                <div className={styles.previewMsg}>{openingConfig.openingMessage}</div>
              </div>
            </div>
          )}

          {openingConfig.openingQuestionsEnabled &&
            (openingConfig.openingQuestions?.length ?? 0) > 0 &&
            messages.length === 0 && (
              <div className={styles.openingQuestions}>
                {(openingConfig.openingQuestions ?? []).map((q, i) => (
                  <span
                    key={i}
                    onClick={() => doSend(q)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 14,
                      border: '1px solid rgba(104,119,144,0.15)',
                      fontSize: 12,
                      color: '#506070',
                      cursor: 'pointer',
                      background: '#fff',
                    }}
                  >
                    {q}
                  </span>
                ))}
              </div>
            )}

          {messages.map((msg) =>
            msg.sender === 'user' ? (
              <div key={msg.id} className={`${styles.previewBubble} ${styles.previewBubbleUser}`}>
                <div style={{ maxWidth: '75%', minWidth: 0 }}>
                  <div className={styles.previewMsg}>{msg.text}</div>
                  <div className={styles.previewMeta}><span>{msg.time}</span></div>
                </div>
              </div>
            ) : (
              <div key={msg.id} className={styles.previewBubble}>
                <img src={avatar} alt="" className={styles.previewAvatarSmall} />
                <div style={{ maxWidth: '75%', minWidth: 0 }}>
                  {msg.toolCall ? (
                    <ToolCallCard record={msg.toolCall} />
                  ) : (
                    <div className={styles.previewMsg}>
                    {msg.text || (sending ? '思考中...' : '无法获取回复')}
                    </div>
                  )}
                  <div className={styles.previewMeta}><span>{msg.time}</span></div>
                </div>
              </div>
            )
          )}
          <div ref={chatEndRef} />
        </div>
      )}

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
      <div className={styles.previewInputRow}>
        <Button
          icon={<PaperClipOutlined />}
          type="text"
          onClick={() => fileInputRef.current?.click()}
          aria-label="文件上传"
          className={styles.previewAttachBtn}
          disabled={isPublished === false}
        />
        <input
          className={styles.previewInput}
          placeholder={isPublished === false ? '请先发布智能体' : '输入消息...'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending || isPublished === false}
        />
        <button
          className={styles.previewSendBtn}
          onClick={handleSend}
          disabled={sending || isPublished === false}
          style={{ opacity: sending || isPublished === false ? 0.5 : 1, cursor: sending || isPublished === false ? 'not-allowed' : 'pointer' }}
        >
          {sending ? '等待...' : '发送'}
        </button>
      </div>
    </div>
  )
}
