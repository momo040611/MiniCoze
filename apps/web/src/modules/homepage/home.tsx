import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Select, Input, Button, Tag, Skeleton, Empty, message, Modal, Avatar } from 'antd'
import {
  PaperClipOutlined, SendOutlined, CloseOutlined, PlusOutlined,
  MessageOutlined, DeleteOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ExclamationCircleOutlined, CopyOutlined, ReloadOutlined, EditOutlined,
  DownOutlined,
} from '@ant-design/icons'
import styles from './home.module.css'
import { getConversations, getConversation, deleteConversation } from '../../api/homepage'
import type { Conversation } from '../../api/homepage'
import { runAgentStream } from '../../api/agent-runtime'
import type {
  RuntimeEvent, TokenUsage,
  ToolCallCreatedEvent, ToolCallCompletedEvent,
  KnowledgeStatusEvent,
} from '../../api/agent-runtime'
import { getAgentList } from '../../api/agent-config'
import { formatFileSize } from './utils/format'
import { ToolCallCard, type ToolCallData } from '../agent-config/components/ToolCallCard'
import { DebugInfoPanel } from '../agent-config/components/DebugInfoPanel'
import { KnowledgeStatus } from '../agent-config/components/KnowledgeStatus'
import { MarkdownRenderer } from '../../components/chat/MarkdownRenderer'

// ---- 升级后的消息模型 ----

interface ToolCallMessage {
  kind: 'tool-call';
  id: string;
  toolData: ToolCallData;
}

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

interface ErrorMessage {
  kind: 'error';
  id: string;
  errorText: string;
  retryText: string;
}

type ChatItem = ChatMessage | ToolCallMessage | ErrorMessage;

// 智能体会话缓存
interface AgentSessionState {
  conversationId: string | null;
  messages: ChatItem[];
}

const NavPlaceholderText = '请输入指令...'

export const HomepageIndex = () => {
  const [searchParams] = useSearchParams();

  const [messages, setMessages] = useState<ChatItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatListRef = useRef<HTMLDivElement>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ file: File; preview: string; isImage: boolean; size: string } | null>(null)
  const [allAgents, setAllAgents] = useState<{ id: string; name: string; icon: string }[]>([])
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string; icon: string } | null>(null)
  const [agentLoadError, setAgentLoadError] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)
  const lastContentRef = useRef('')
  const conversationIdRef = useRef<string | null>(null)

  const [currentRunId, setCurrentRunId] = useState('')
  const [currentLatency, setCurrentLatency] = useState(0)
  const [currentUsage, setCurrentUsage] = useState<TokenUsage | null>(null)
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallData[]>([])
  const [knowledgeEvent, setKnowledgeEvent] = useState<{ type: string; runId: string; knowledge: { bound: boolean; knowledgeName?: string; retrievedCount?: number } } | null>(null)
  const [knowledgeDismissed, setKnowledgeDismissed] = useState(false)
  const runStartRef = useRef(0)
  const lastUserMessageRef = useRef('')  


  const agentSessionsRef = useRef<Map<string, AgentSessionState>>(new Map())


  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const loadConversationMessages = useCallback(async (convId: string) => {
    setConversationId(convId)
    conversationIdRef.current = convId
    setMessages([])

    const detail = await getConversation(convId)
    if (!detail) {
      message.error('对话不存在')
      return
    }

    const msgs: ChatItem[] = detail.messages
      .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
      .map((m): ChatItem => ({
        kind: 'message',
        id: m.id,
        text: m.content,
        time: new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        sender: (m.role === 'USER' ? 'user' : 'agent') as 'user' | 'agent',
        status: 'success',
        agentName: m.role === 'ASSISTANT' && detail.agent ? detail.agent.name : undefined,
      }))
    setMessages(msgs)
  }, [])

  const loadConversations = useCallback((options?: { autoOpenLatest?: boolean }) => {
    if (!selectedAgent) return Promise.resolve([] as Conversation[])
    setLoadingConversations(true)

    return getConversations(selectedAgent.id)
      .then(async (data) => {
        const list = Array.isArray(data) ? data : []
        setConversations(list)

        if (options?.autoOpenLatest) {
          const latest = list[0]
          if (latest) {
            await loadConversationMessages(latest.id)
          } else {
            setConversationId(null)
            setMessages([])
          }
        }

        return list
      })
      .catch((err) => {
        console.error(err)
        message.error('加载历史对话失败，请稍后重试')
        return []
      })
      .finally(() => {
        setLoadingConversations(false)
      })
  }, [loadConversationMessages, selectedAgent])

  const loadAgents = useCallback(() => {
    setAgentLoadError(false)
    getAgentList().then((list) => {
      const agents = list.map((a) => ({ id: a.id, name: a.name, icon: a.avatar || '' }))
      setAllAgents(agents)
      if (agents.length > 0) {
        
        const agentIdFromUrl = searchParams.get('agentId')
        const foundAgent = agentIdFromUrl
          ? agents.find((a) => a.id === agentIdFromUrl)
          : null
        setSelectedAgent(foundAgent ?? agents[0])
      }
    }).catch((err) => {
      console.error('加载智能体列表失败', err)
      setAgentLoadError(true)
      message.error('加载智能体列表失败')
    })
  }, [searchParams])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  useEffect(() => {
    if (!selectedAgent) return


    const cached = agentSessionsRef.current.get(selectedAgent.id)
    if (cached) {
      setConversationId(cached.conversationId)
      setMessages(cached.messages)
      loadConversations()
      return
    }

    const conversationIdFromUrl = searchParams.get('conversationId')
    if (conversationIdFromUrl) {
      setConversationId(null)
      setMessages([])
      loadConversations().then(() => {
        loadConversationMessages(conversationIdFromUrl).catch(() => {
          // 如果加载失败（比如对话不存在），则加载最新的
          loadConversations({ autoOpenLatest: true })
        })
      })
    } else {
      setConversationId(null)
      setMessages([])
      loadConversations({ autoOpenLatest: true })
    }

  }, [loadConversations, loadConversationMessages, selectedAgent, searchParams])

  const handleNewChat = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setConversationId(null)
    conversationIdRef.current = null
    setMessages([])
    setSending(false)
    sendingRef.current = false
    // 重置调试状态
    setCurrentRunId('')
    setCurrentLatency(0)
    setCurrentUsage(null)
    setCurrentToolCalls([])
    setKnowledgeEvent(null)
    setKnowledgeDismissed(false)
  }, [])

  const handleSelectConversation = useCallback(async (convId: string) => {
    if (convId === conversationId) return
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setSending(false)
    sendingRef.current = false
    try {
      await loadConversationMessages(convId)
    } catch (e) {
      console.error(e)
      message.error('加载对话详情失败')
    }
  }, [conversationId, loadConversationMessages])

  const handleDeleteConversation = useCallback((e: React.MouseEvent, convId: string) => {
    e.stopPropagation()
    Modal.confirm({
      title: '确认删除',
      content: '删除后对话记录将无法恢复',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteConversation(convId)
          message.success('已删除')
          if (convId === conversationId) {
            setConversationId(null)
            setMessages([])
          }
          loadConversations()
        } catch (err) {
          console.error(err)
          message.error('删除对话失败')
        }
      },
    })
  }, [conversationId, loadConversations, setMessages])

  // C2: 智能体切换时保存/恢复会话状态
  const handleAgentSwitch = useCallback((agentId: string) => {
    const agent = allAgents.find((a) => a.id === agentId)
    if (!agent) return

    // 保存当前会话状态
    if (selectedAgent) {
      agentSessionsRef.current.set(selectedAgent.id, {
        conversationId,
        messages,
      })
    }

    // 中止当前流
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setSending(false)
    sendingRef.current = false

    // 切换智能体
    setSelectedAgent(agent)
  }, [allAgents, selectedAgent, conversationId, messages])

  useEffect(() => {
    return () => {
      if (selectedFile?.preview) {
        URL.revokeObjectURL(selectedFile.preview)
      }
    }
  }, [selectedFile])

  const scrollToBottom = (smooth = true) => {
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  const handleChatScroll = useCallback(() => {
    const el = chatListRef.current
    if (!el) return
    // 距离底部超过 100px 时显示"回到底部"按钮
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBottom(distFromBottom > 120)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toolCallStartRef = useRef(new Map<string, number>())

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim()
    if (!text || sendingRef.current || !selectedAgent) return

    // 文件内容提取：.txt 文件读取内容拼接
    let messageText = text
    if (selectedFile) {
      const fileName = selectedFile.file.name
      const isTextFile = selectedFile.file.type === 'text/plain' || fileName.endsWith('.txt')
      if (isTextFile) {
        try {
          const fileContent = await selectedFile.file.text()
          messageText = `[文件: ${fileName}]\n${fileContent}\n\n---\n用户问题: ${text}`
        } catch {
          messageText = text + `\n\n[已上传文件: ${fileName} (${selectedFile.size})]`
        }
      } else {
        messageText = text + `\n\n[已上传文件: ${fileName} (${selectedFile.size})]`
      }
    }

    lastUserMessageRef.current = text

    const now = new Date()
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const userMsg: ChatMessage = {
      kind: 'message',
      id: `user-${Date.now()}`,
      text: text,
      time: timestamp,
      sender: 'user',
      status: 'success',
      agentName: selectedAgent.name,
    }

    if (selectedFile) {
      userMsg.fileName = selectedFile.file.name
      userMsg.filePreview = selectedFile.preview
      userMsg.fileIsImage = selectedFile.isImage
    }

    const agentMsgId = `agent-${Date.now()}`
    const agentMsg: ChatMessage = {
      kind: 'message',
      id: agentMsgId,
      text: '',
      time: timestamp,
      sender: 'agent',
      status: 'sending',
      agentName: selectedAgent.name,
    }

    setMessages((prev) => [...prev, userMsg, agentMsg])
    if (!overrideText) setInputValue('')
    handleFileRemove()
    setSending(true)
    sendingRef.current = true
    lastContentRef.current = ''

    // B4: 重置调试状态
    setCurrentRunId('')
    setCurrentLatency(0)
    setCurrentUsage(null)
    setCurrentToolCalls([])
    setKnowledgeEvent(null)
    setKnowledgeDismissed(false)
    runStartRef.current = performance.now()

    const abortController = await runAgentStream(
      {
        agentId: selectedAgent.id,
        message: messageText,
        conversationId: conversationId ?? undefined,
      },
      {
        onEvent: (event: RuntimeEvent) => {
          switch (event.type) {
            case 'run.created':
              setCurrentRunId(event.runId)
              if (!conversationIdRef.current) {
                conversationIdRef.current = event.conversationId
                setConversationId(event.conversationId)
              }
              break

            case 'knowledge.status': {
              const ksEvent = event as KnowledgeStatusEvent
              setKnowledgeEvent({
                type: ksEvent.type,
                runId: ksEvent.runId,
                knowledge: ksEvent.knowledge,
              })
              setKnowledgeDismissed(false)
              break
            }

            case 'message.delta': {
              lastContentRef.current += event.content
              setMessages((prev) =>
                prev.map((m) =>
                  m.kind === 'message' && m.id === agentMsgId
                    ? { ...m, text: lastContentRef.current, status: 'streaming' as const, messageId: event.messageId }
                    : m
                )
              )
              break
            }

            case 'message.completed':
              setMessages((prev) =>
                prev.map((m) =>
                  m.kind === 'message' && m.id === agentMsgId
                    ? { ...m, text: event.content, status: 'success' as const, id: event.messageId, messageId: event.messageId }
                    : m
                )
              )
              break

            case 'tool.call.created': {
              const tcEvent = event as ToolCallCreatedEvent
              toolCallStartRef.current.set(tcEvent.toolCallId, performance.now())
              const newToolCall: ToolCallData = {
                toolCallId: tcEvent.toolCallId,
                name: tcEvent.name,
                args: tcEvent.args,
                status: 'executing',
              }
              setCurrentToolCalls((prev) => [...prev, newToolCall])
              setMessages((prev) => [...prev, {
                kind: 'tool-call',
                id: `tool-${tcEvent.toolCallId}`,
                toolData: newToolCall,
              }])
              break
            }

            case 'tool.call.completed': {
              const tcCompleteEvent = event as ToolCallCompletedEvent & { error?: string }
              const startTime = toolCallStartRef.current.get(tcCompleteEvent.toolCallId)
              const duration = startTime ? Math.round(performance.now() - startTime) : undefined
              toolCallStartRef.current.delete(tcCompleteEvent.toolCallId)
              const isFailed = !!tcCompleteEvent.error
              setCurrentToolCalls((prev) =>
                prev.map((tc) =>
                  tc.toolCallId === tcCompleteEvent.toolCallId
                    ? { ...tc, status: isFailed ? 'failed' : 'success', result: tcCompleteEvent.result, error: tcCompleteEvent.error, duration }
                    : tc
                )
              )
              setMessages((prev) =>
                prev.map((m) =>
                  m.kind === 'tool-call' && m.id === `tool-${tcCompleteEvent.toolCallId}`
                    ? { ...m, toolData: { ...m.toolData, status: isFailed ? 'failed' : 'success', result: tcCompleteEvent.result, error: tcCompleteEvent.error, duration } }
                    : m
                )
              )
              break
            }

            case 'run.completed':
              setCurrentUsage(event.usage ?? null)
              setCurrentLatency(Math.round(performance.now() - runStartRef.current))
              setSending(false)
              sendingRef.current = false
              abortRef.current = null
              loadConversations()
              break

            case 'stream.done':
              setSending(false)
              sendingRef.current = false
              abortRef.current = null
              loadConversations()
              break

            case 'run.failed': {
              const errMsg: ErrorMessage = {
                kind: 'error',
                id: `err-${Date.now()}`,
                errorText: `运行失败: ${event.error}`,
                retryText: lastUserMessageRef.current || text,
              }
              setMessages((prev) => prev.map((m) =>
                m.kind === 'message' && m.id === agentMsgId
                  ? { ...m, status: 'failed' as const }
                  : m
              ))
              setMessages((prev) => [...prev, errMsg])
              message.error(`运行失败: ${event.error}`)
              setSending(false)
              sendingRef.current = false
              abortRef.current = null
              break
            }

            case 'run.in_progress':
              break

            default:
              break
          }
        },
        onError: (err) => {
          console.error(err)
          const errMsg: ErrorMessage = {
            kind: 'error',
            id: `err-${Date.now()}`,
            errorText: `发送消息失败: ${err.message}`,
            retryText: lastUserMessageRef.current || text,
          }
          setMessages((prev) => prev.map((m) =>
            m.kind === 'message' && m.id === agentMsgId
              ? { ...m, status: 'failed' as const }
              : m
          ))
          setMessages((prev) => [...prev, errMsg])
          message.error('发送消息失败，请重试')
          setSending(false)
          sendingRef.current = false
          abortRef.current = null
        },
      },
    )

    abortRef.current = abortController
  }, [inputValue, selectedAgent, conversationId, selectedFile, loadConversations])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
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

  const copyToClipboard = (text: string) => {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        message.success('已复制')
      }).catch(() => {
        fallbackCopy(text)
      })
    } else {
      fallbackCopy(text)
    }
  }

  const fallbackCopy = (text: string) => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      message.success('已复制')
    } catch {
      message.error('复制失败')
    } finally {
      document.body.removeChild(textarea)
    }
  }

  const handleRegenerate = () => {
    if (lastUserMessageRef.current) {
      sendMessage(lastUserMessageRef.current)
    }
  }

  const handleStartEdit = (msgId: string, text: string) => {
    setEditingMsgId(msgId)
    setEditText(text)
  }

  const handleSaveEdit = () => {
    const trimmed = editText.trim()
    if (!trimmed) return
    setEditingMsgId(null)
    setEditText('')
    sendMessage(trimmed)
  }

  // ---- 渲染 ----

  const renderMessageItem = (item: ChatItem) => {
    // B7: 错误卡片
    if (item.kind === 'error') {
      return (
        <div key={item.id} className={styles.errorCard}>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />
          <span className={styles.errorText}>{item.errorText}</span>
          <Button
            size="small"
            type="primary"
            danger
            onClick={() => sendMessage(item.retryText)}
            style={{ flexShrink: 0 }}
          >
            重新发送
          </Button>
        </div>
      )
    }

    // B2: 工具调用卡片
    if (item.kind === 'tool-call') {
      return <ToolCallCard key={item.id} data={item.toolData} />
    }

    // 聊天消息
    const isUser = item.sender === 'user'
    const isStreaming = item.status === 'streaming'
    const isSending = item.status === 'sending'
    const isFailed = item.status === 'failed'
    const isEditing = editingMsgId === item.id

    return (
      <div key={item.id} className={`${styles.chatMessage} ${isUser ? styles.userRow : styles.agentRow}`}>
        {!isUser && (
          <Avatar
            size={32}
            src={item.agentIcon}
            className={styles.agentAvatar}
          >
            {(item.agentName || 'A')[0].toUpperCase()}
          </Avatar>
        )}
        <div className={`${styles.messageContent} ${isUser ? styles.userBubble : styles.agentBubble}`}>
          {/* 编辑模式（仅用户消息） */}
          {isUser && isEditing ? (
            <div className={styles.editArea}>
              <Input.TextArea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 6 }}
                className={styles.editTextarea}
              />
              <div className={styles.editActions}>
                <Button size="small" type="primary" onClick={handleSaveEdit}>
                  保存并重新发送
                </Button>
                <Button size="small" onClick={() => setEditingMsgId(null)}>
                  取消
                </Button>
              </div>
            </div>
          ) : isSending ? (
            <span className={styles.thinkingText}>思考中...</span>
          ) : isFailed ? (
            <span className={styles.failedText}>⚠ {item.text || '回复生成失败'}</span>
          ) : isUser ? (
            <div
              className={styles.userTextWrap}
              onDoubleClick={() => handleStartEdit(item.id, item.text)}
              title="双击编辑消息"
            >
              <span className={styles.messageText}>{item.text}</span>
              {item.fileName && item.filePreview && item.fileIsImage && (
                <img src={item.filePreview} alt={item.fileName} className={styles.messageFile} />
              )}
              {item.fileName && !item.fileIsImage && (
                <Tag className={styles.messageFileTag}>{item.fileName}</Tag>
              )}
              <EditOutlined className={styles.editHint} />
            </div>
          ) : (
            <>
              <MarkdownRenderer content={item.text} isStreaming={isStreaming} />
              {item.fileName && item.filePreview && item.fileIsImage && (
                <img src={item.filePreview} alt={item.fileName} className={styles.messageFile} />
              )}
              {item.fileName && !item.fileIsImage && (
                <Tag className={styles.messageFileTag}>{item.fileName}</Tag>
              )}
            </>
          )}

          {/* 操作按钮栏（仅 AI 回复，成功状态） */}
          {!isUser && item.status === 'success' && !isStreaming && (
            <div className={styles.messageActions}>
              <Button
                icon={<CopyOutlined />}
                size="small"
                type="text"
                onClick={() => copyToClipboard(item.text)}
              >
                复制
              </Button>
              <Button
                icon={<ReloadOutlined />}
                size="small"
                type="text"
                onClick={handleRegenerate}
              >
                重新生成
              </Button>
            </div>
          )}
        </div>
        <span className={styles.messageTime}>{item.time}</span>
      </div>
    )
  }

  return (
    <div className={styles.windowBox}>
      <div className={`${styles.historyPanel} ${historyOpen ? styles.historyPanelOpen : ''}`}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleNewChat}
          className={styles.newChatBtn}
        >
          新对话
        </Button>
        <div className={styles.historyList}>
          {loadingConversations ? (
            <>
              <Skeleton active paragraph={{ rows: 1 }} title={false} style={{ padding: '8px 12px' }} />
              <Skeleton active paragraph={{ rows: 1 }} title={false} style={{ padding: '8px 12px' }} />
              <Skeleton active paragraph={{ rows: 1 }} title={false} style={{ padding: '8px 12px' }} />
            </>
          ) : conversations.length === 0 ? (
            <Empty description="暂无历史对话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`${styles.historyItem} ${conv.id === conversationId ? styles.historyItemActive : ''}`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <MessageOutlined className={styles.historyItemIcon} />
                <div className={styles.historyItemContent}>
                  <span className={styles.historyItemTitle}>{conv.title || '新对话'}</span>
                  <span className={styles.historyItemAgent}>{selectedAgent?.name || ''}</span>
                </div>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  className={styles.historyItemDelete}
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  aria-label="删除对话"
                />
              </div>
            ))
          )}
        </div>
      </div>
      <div className={styles.chatPanel}>
        <div className={styles.chatTopBar}>
          <Button
            type="text"
            icon={historyOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={() => setHistoryOpen(!historyOpen)}
            className={styles.toggleBtn}
            aria-label="切换历史面板"
          />
          {selectedAgent && (
            <span className={styles.activeAgentLabel}>
              🤖 {selectedAgent.name}
            </span>
          )}
        </div>

        {/* 可滚动的消息区域 */}
        <div className={styles.chatMessagesWrapper} ref={chatListRef} onScroll={handleChatScroll}>
          {!knowledgeDismissed && knowledgeEvent && (
            <KnowledgeStatus
              knowledgeEvent={knowledgeEvent}
              onClose={() => setKnowledgeDismissed(true)}
            />
          )}
          {messages.length === 0 ? (
            <Empty className={styles.chatPlaceholder} description="准备大干一场吧" />
          ) : (
            <div className={styles.chatMessageList}>
              {messages.map((item) => renderMessageItem(item))}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* 回到底部浮动按钮 */}
          {showScrollBottom && (
            <Button
              className={styles.scrollBottomBtn}
              shape="circle"
              icon={<DownOutlined />}
              onClick={() => scrollToBottom()}
              aria-label="回到底部"
            />
          )}
        </div>

        {/* 固定在底部的输入区域 */}
        <div className={styles.chatInputArea}>
          <div className={styles.leftSelect}>
            <Select
              className={styles.agentSelect}
              value={selectedAgent?.id}
              placeholder="选择智能体"
              notFoundContent={
                agentLoadError ? (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <span style={{ color: '#ff4d4f', fontSize: 13 }}>加载失败</span>
                    <div style={{ marginTop: 6 }}>
                      <Button size="small" type="link" onClick={() => loadAgents()}>
                        重新加载
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Empty description="暂无智能体" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )
              }
              onChange={(value) => handleAgentSwitch(String(value))}
              options={allAgents.map((agt) => ({
                value: agt.id,
                label: (
                  <span>
                    <Avatar size={18} src={agt.icon} style={{ marginRight: 6 }}>
                      {agt.name[0]}
                    </Avatar>
                    {agt.name}
                  </span>
                ),
              }))}
            />
          </div>
          <div className={styles.centerInput}>
            {selectedFile && (
              <div className={styles.filePreviewBar}>
                {selectedFile.isImage ? (
                  <img src={selectedFile.preview} alt={selectedFile.file.name} className={styles.filePreviewThumb} />
                ) : (
                  <span className={styles.docIcon}>📄</span>
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
            <div className={styles.inputRow}>
              <Button
                icon={<PaperClipOutlined />}
                type="text"
                onClick={() => fileInputRef.current?.click()}
                aria-label="文件上传"
              />
              <Input.TextArea
                placeholder={NavPlaceholderText}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                autoSize={{ minRows: 1, maxRows: 3 }}
                variant="borderless"
              />
              <Button
                icon={<SendOutlined />}
                type="primary"
                shape="circle"
                onClick={() => sendMessage()}
                loading={sending}
                disabled={sending}
                aria-label="发送信息"
              />
            </div>
          </div>
          {/* B4: 调试信息面板 */}
          {(currentRunId || currentToolCalls.length > 0) && (
            <DebugInfoPanel
              runId={currentRunId}
              model={selectedAgent?.name ?? ''}
              latency={currentLatency}
              usage={currentUsage}
              toolCalls={currentToolCalls}
            />
          )}
        </div>
      </div>
    </div>
  )
}
