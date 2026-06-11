import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Select, Input, Button, Skeleton, Empty, message, Modal, Avatar } from 'antd'
import {
  PaperClipOutlined, SendOutlined, CloseOutlined, PlusOutlined,
  MessageOutlined, DeleteOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ExclamationCircleOutlined, CopyOutlined, ReloadOutlined, EditOutlined,
  DownOutlined, PauseOutlined,
} from '@ant-design/icons'
import styles from './home.module.css'
import { getConversations, deleteConversation } from '../../api/homepage'
import type { Conversation } from '../../api/homepage'
import { getAgentList } from '../../api/agent-config'
import { ToolCallCard } from '../agent-config/components/ToolCallCard'
import { DebugInfoPanel } from '../agent-config/components/DebugInfoPanel'
import { KnowledgeStatus } from '../agent-config/components/KnowledgeStatus'
import { MarkdownRenderer } from './components/chat/MarkdownRenderer'
import { copyToClipboard } from '../../utils/clipboard'
import { ChatAttachmentList } from '../chat/components/ChatAttachmentList'
import { useAgentChat } from '../chat/hooks/useAgentChat'
import { CHAT_ATTACHMENT_ACCEPT, useChatAttachments } from '../chat/hooks/useChatAttachments'
import type { ChatItem } from '../chat/types'

// 智能体会话缓存
interface AgentSessionState {
  conversationId: string | null;
  messages: ChatItem[];
}

const NavPlaceholderText = '请输入指令...'

// 引用消息接口
interface QuotedMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  agentName?: string;
}

function getAgentKnowledgeBaseId(orchestration: string) {
  try {
    const parsed = JSON.parse(orchestration || '{}') as {
      planner?: { databases?: unknown };
    };
    return Array.isArray(parsed.planner?.databases) && parsed.planner.databases.length > 0
      ? String(parsed.planner.databases[0])
      : undefined;
  } catch {
    return undefined;
  }
}

export function HomepageIndex() {
  const [searchParams] = useSearchParams();

  const [inputValue, setInputValue] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatListRef = useRef<HTMLDivElement>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [allAgents, setAllAgents] = useState<{ id: string; name: string; icon: string; persona: string; model: string; temperature: number; orchestration: string }[]>([])
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string; icon: string; persona: string; model: string; temperature: number; orchestration: string } | null>(null)
  const [agentLoadError, setAgentLoadError] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [knowledgeDismissed, setKnowledgeDismissed] = useState(false)
  const lastUserMessageRef = useRef('')
  const loadConversationsRef = useRef<() => void>(() => undefined)
  const handleChatRunFinished = useCallback(() => {
    loadConversationsRef.current()
  }, [])
  const {
    selectedAttachment: selectedFile,
    readyAttachments,
    selectFile,
    clearAttachments,
    uploading: attachmentUploading,
    failed: attachmentFailed,
  } = useChatAttachments()
  const {
    items: messages,
    setItems: setMessages,
    conversationId,
    sending,
    currentRunId,
    currentLatency,
    currentUsage,
    currentToolCalls,
    knowledgeEvent,
    sendMessage: sendChatMessage,
    stop: stopChat,
    loadConversation: loadChatConversation,
    replaceSession,
    startNewConversation,
  } = useAgentChat({
    agentId: selectedAgent?.id ?? null,
    preview: false,
    model: selectedAgent?.model,
    systemPrompt: selectedAgent?.persona,
    temperature: selectedAgent?.temperature,
    maxTokens: 4096,
    knowledgeBaseId: selectedAgent ? getAgentKnowledgeBaseId(selectedAgent.orchestration) : undefined,
    agentName: selectedAgent?.name,
    agentIcon: selectedAgent?.icon,
    appendErrorItems: true,
    onRunFinished: handleChatRunFinished,
  })

  // 流式输出渲染节流：使用 rAF 批量更新

  // 用户是否主动向上滚动（用于控制自动滚动）
  const userScrolledUpRef = useRef(false)
  // 上次滚动位置，用于检测滚动方向
  const lastScrollTopRef = useRef(0)

  const agentSessionsRef = useRef<Map<string, AgentSessionState>>(new Map())


  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // 引用消息状态
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessage | null>(null)

  const loadConversationMessages = useCallback(async (convId: string) => {
    await loadChatConversation(convId)
  }, [loadChatConversation])

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
            startNewConversation()
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
  }, [loadConversationMessages, selectedAgent, startNewConversation])

  loadConversationsRef.current = () => {
    void loadConversations()
  }

  const loadAgents = useCallback(() => {
    setAgentLoadError(false)
    getAgentList().then((list) => {
      const agents = list.map((a) => ({ id: a.id, name: a.name, icon: a.avatar || '', persona: a.persona, model: a.model || '', temperature: a.temperature ?? 0.7, orchestration: a.orchestration || '' }))
      setAllAgents(agents)
      if (agents.length > 0) {
        // 优先使用 URL 中的 agentId，确保数据一致性
        const agentIdFromUrl = searchParams.get('agentId')
        const foundAgent = agentIdFromUrl
          ? agents.find((a) => a.id === agentIdFromUrl)
          : null
        // 如果 URL 中的 agentId 对应的智能体不存在，则使用第一个智能体
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

    // 检查是否有缓存的会话状态
    const cached = agentSessionsRef.current.get(selectedAgent.id)
    if (cached) {
      replaceSession(cached.conversationId, cached.messages)
      loadConversations()
      return
    }

    // 从 URL 获取 conversationId，验证是否属于当前智能体
    const conversationIdFromUrl = searchParams.get('conversationId')
    if (conversationIdFromUrl) {
      startNewConversation()
      // 先加载对话列表，验证 conversationId 是否属于当前智能体
      loadConversations().then((list) => {
        const conversationBelongsToAgent = list.some((c) => c.id === conversationIdFromUrl)
        if (conversationBelongsToAgent) {
          // 对话属于当前智能体，加载该对话
          loadConversationMessages(conversationIdFromUrl).catch(() => {
            // 如果加载失败，显示新对话
            startNewConversation()
          })
        } else {
          // 对话不属于当前智能体，显示新对话
          startNewConversation()
        }
      })
    } else {
      // 默认显示新对话，不自动加载最近对话
      startNewConversation()
      loadConversations()
    }

  }, [loadConversations, loadConversationMessages, replaceSession, selectedAgent, searchParams, startNewConversation])

  const handleNewChat = useCallback(() => {
    stopChat()
    startNewConversation()
    clearAttachments()
    userScrolledUpRef.current = false // 重置滚动标志
    setKnowledgeDismissed(false)
  }, [clearAttachments, startNewConversation, stopChat])

  const handleSelectConversation = useCallback(async (convId: string) => {
    if (convId === conversationId) return
    stopChat()
    try {
      await loadConversationMessages(convId)
    } catch (e) {
      console.error(e)
      message.error('加载对话详情失败')
    }
  }, [conversationId, loadConversationMessages, stopChat])

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
            startNewConversation()
          }
          loadConversations()
        } catch (err) {
          console.error(err)
          message.error('删除对话失败')
        }
      },
    })
  }, [conversationId, loadConversations, startNewConversation])

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
    stopChat()

    // 切换智能体
    setSelectedAgent(agent)
  }, [allAgents, selectedAgent, conversationId, messages, stopChat])

  const scrollToBottom = (smooth = true) => {
    userScrolledUpRef.current = false // 重置滚动标志
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  const handleChatScroll = useCallback(() => {
    const el = chatListRef.current
    if (!el) return

    const currentScrollTop = el.scrollTop
    const distFromBottom = el.scrollHeight - currentScrollTop - el.clientHeight

    // 检测滚动方向：向上滚动时设置标志
    if (currentScrollTop < lastScrollTopRef.current && distFromBottom > 120) {
      userScrolledUpRef.current = true
    }

    // 如果滚动到底部附近，重置标志
    if (distFromBottom <= 120) {
      userScrolledUpRef.current = false
    }

    lastScrollTopRef.current = currentScrollTop
    setShowScrollBottom(distFromBottom > 120)
  }, [])

  // 使用 requestAnimationFrame 节流滚动，避免流式输出时频繁触发
  // 只有当用户没有主动向上滚动时才自动滚动到底部
  const rafRef = useRef<number>(0)
  useEffect(() => {
    // 如果用户主动向上滚动，不自动滚动
    if (userScrolledUpRef.current) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [messages])

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim()
    if (!text || !selectedAgent || sending) return

    if (attachmentUploading) {
      message.warning('附件上传中，请稍后再发送')
      return
    }
    if (attachmentFailed) {
      message.error(selectedFile?.errorText ?? '附件上传失败，请删除后重新选择')
      return
    }

    let messageText = text
    if (quotedMessage) {
      const quotePrefix = quotedMessage.sender === 'user'
        ? `> 引用你的消息：${quotedMessage.text}\n\n`
        : `> 引用${quotedMessage.agentName || 'AI'}的回复：${quotedMessage.text}\n\n`
      messageText = quotePrefix + messageText
    }

    lastUserMessageRef.current = text
    const sent = await sendChatMessage({
      content: messageText,
      displayContent: text,
      attachments: readyAttachments,
    })

    if (sent) {
      if (!overrideText) setInputValue('')
      clearAttachments()
      setQuotedMessage(null)
      setKnowledgeDismissed(false)
    }
  }, [
    attachmentFailed,
    attachmentUploading,
    clearAttachments,
    inputValue,
    quotedMessage,
    readyAttachments,
    selectedAgent,
    selectedFile?.errorText,
    sendChatMessage,
    sending,
  ])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  // 停止生成
  const handleStopGeneration = useCallback(() => {
    stopChat()
  }, [stopChat])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    void selectFile(file)
  }

  const handleFileRemove = () => {
    clearAttachments()
  }

  // 拖拽上传状态
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    const file = e.dataTransfer.files[0]
    if (!file) return

    // 检查文件类型
    const allowedTypes = [
      'image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp',
      'text/plain', 'text/markdown', 'text/x-markdown',
    ]
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.md']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      message.error('不支持的文件类型')
      return
    }

    void selectFile(file)
  }, [selectFile])

  const handleRegenerate = useCallback(() => {
    if (!lastUserMessageRef.current || sending) return

    // 移除最后一条 AI 回复消息（及其后面的 tool-call 和 error）
    setMessages((prev) => {
      const lastUserIdx = [...prev].reverse().findIndex(
        (m) => m.kind === 'message' && m.sender === 'user'
      )
      if (lastUserIdx === -1) return prev
      const cutIdx = prev.length - 1 - lastUserIdx
      // 保留用户消息及之前的所有内容，移除之后的 AI 回复、tool-call、error
      return prev.slice(0, cutIdx + 1)
    })

    // 用最后一条用户消息重新发送（保留原 conversationId 以延续上下文）
    const textToResend = lastUserMessageRef.current
    // 延迟一帧确保 state 更新后再发送
    setTimeout(() => sendMessage(textToResend), 0)
  }, [sendMessage, sending])

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

  // 引用消息
  const handleQuoteMessage = useCallback((msgId: string, text: string, sender: 'user' | 'agent', agentName?: string) => {
    setQuotedMessage({
      id: msgId,
      text: text.length > 100 ? text.slice(0, 100) + '...' : text,
      sender,
      agentName,
    })
  }, [])

  // 取消引用
  const handleCancelQuote = useCallback(() => {
    setQuotedMessage(null)
  }, [])

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

    if (item.kind === 'knowledge' || item.kind === 'debug') {
      return null
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
              <ChatAttachmentList
                attachments={item.attachments}
                imageClassName={styles.messageFile}
                itemClassName={styles.messageFileTag}
                compact
              />
              <EditOutlined className={styles.editHint} />
            </div>
          ) : (
            <>
              <MarkdownRenderer content={item.text} isStreaming={isStreaming} />
              <ChatAttachmentList
                attachments={item.attachments}
                imageClassName={styles.messageFile}
                itemClassName={styles.messageFileTag}
                compact
              />
            </>
          )}

          {/* 操作按钮栏 */}
          {item.status === 'success' && !isStreaming && (
            <div className={styles.messageActions}>
              {!isUser && (
                <>
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
                </>
              )}
              <Button
                size="small"
                type="text"
                onClick={() => handleQuoteMessage(item.id, item.text, item.sender, item.agentName)}
              >
                引用
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
      {/* 移动端遮罩层 */}
      <div
        className={`${styles.historyMask} ${historyOpen ? styles.historyMaskVisible : ''}`}
        onClick={() => setHistoryOpen(false)}
      />
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
            <div className={styles.welcomeState}>
              <div className={styles.welcomeIcon}>✨</div>
              <h2 className={styles.welcomeTitle}>开始新的对话</h2>
              <p className={styles.welcomeDesc}>
                选择一个智能体，输入你的问题开始探索
              </p>
              <div className={styles.welcomeHints}>
                <div className={styles.hintCard} onClick={() => setInputValue('帮我分析一下这个数据')}>
                  <span className={styles.hintIcon}>📊</span>
                  <span>数据分析</span>
                </div>
                <div className={styles.hintCard} onClick={() => setInputValue('帮我写一段代码')}>
                  <span className={styles.hintIcon}>💻</span>
                  <span>代码编写</span>
                </div>
                <div className={styles.hintCard} onClick={() => setInputValue('帮我总结这篇文章')}>
                  <span className={styles.hintIcon}>📝</span>
                  <span>内容总结</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={styles.chatMessageList}
              role="log"
              aria-live="polite"
              aria-label="对话消息"
              style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
            >
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
          <div
            className={`${styles.centerInput} ${isDragging ? styles.centerInputDragOver : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className={styles.dragOverlay}>
                <PaperClipOutlined style={{ fontSize: 24, color: '#565fe2' }} />
                <span>释放文件以上传</span>
              </div>
            )}
            {selectedFile && !isDragging && (
              <div className={styles.filePreviewBar}>
                {selectedFile.isImage ? (
                  <img src={selectedFile.previewUrl} alt={selectedFile.file.name} className={styles.filePreviewThumb} />
                ) : (
                  <span className={styles.docIcon}>📄</span>
                )}
                <div className={styles.filePreviewInfo}>
                  <span className={styles.filePreviewName}>{selectedFile.file.name}</span>
                  <span className={styles.filePreviewSize}>
                    {selectedFile.sizeText}
                    {' · '}
                    {selectedFile.uploadStatus === 'uploading'
                      ? '上传中'
                      : selectedFile.uploadStatus === 'success'
                        ? '已上传'
                        : (selectedFile.errorText ?? '上传失败')}
                  </span>
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
            {quotedMessage && !isDragging && (
              <div className={styles.quotePreview}>
                <div className={styles.quoteBar} />
                <div className={styles.quoteContent}>
                  <span className={styles.quoteSender}>
                    {quotedMessage.sender === 'user' ? '你' : (quotedMessage.agentName || 'AI')}
                  </span>
                  <span className={styles.quoteText}>{quotedMessage.text}</span>
                </div>
                <Button
                  icon={<CloseOutlined />}
                  size="small"
                  type="text"
                  onClick={handleCancelQuote}
                  aria-label="取消引用"
                />
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              accept={CHAT_ATTACHMENT_ACCEPT}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div className={styles.inputRow}>
              <Button
                icon={<PaperClipOutlined />}
                type="text"
                disabled={sending || selectedFile?.uploadStatus === 'uploading'}
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
              {sending ? (
                <Button
                  icon={<PauseOutlined />}
                  type="primary"
                  danger
                  shape="circle"
                  onClick={handleStopGeneration}
                  aria-label="停止生成"
                />
              ) : (
                <Button
                  icon={<SendOutlined />}
                  type="primary"
                  shape="circle"
                  onClick={() => sendMessage()}
                  disabled={
                    (!inputValue.trim() && !selectedFile) ||
                    selectedFile?.uploadStatus === 'uploading' ||
                    selectedFile?.uploadStatus === 'failed'
                  }
                  aria-label="发送信息"
                />
              )}
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
