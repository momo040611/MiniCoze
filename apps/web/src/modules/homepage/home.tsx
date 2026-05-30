import { useCallback, useEffect, useRef, useState } from 'react'
import { Select, Input, Button, Tag, Skeleton, Empty, message } from 'antd'
import { PaperClipOutlined, SendOutlined, CloseOutlined, PlusOutlined, MessageOutlined, DeleteOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import styles from './home.module.css'
import { getConversations, getConversation, deleteConversation } from '../../api/homepage'
import type { Conversation } from '../../api/homepage'
import { runAgentStream } from '../../api/agent-runtime'
import type { RuntimeEvent } from '../../api/agent-runtime'
import { getAgentList } from '../../api/agent-config'
import { formatFileSize } from './utils/format'

interface Message {
  id: string
  text: string
  timestamp: string
  sender: 'user' | 'agent'
  fileName?: string
  filePreview?: string
  fileIsImage?: boolean
  agentName?: string
  agentIcon?: string
}

const NavPlaceholderText = '请输入指令...'

export const HomepageIndex = () => {

  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [selectedFile, setSelectedFile] = useState<{ file: File; preview: string; isImage: boolean; size: string } | null>(null)
  const [allAgents, setAllAgents] = useState<{ id: string; name: string; icon: string; persona: string; model: string; temperature: number }[]>([])
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string; icon: string; persona: string; model: string; temperature: number } | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadConversationMessages = useCallback(async (convId: string) => {
    setConversationId(convId)
    setMessages([])

    const detail = await getConversation(convId)
    if (!detail) {
      message.error('对话不存在')
      return
    }

    const msgs: Message[] = detail.messages
      .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
      .map((m) => ({
        id: m.id,
        text: m.content,
        timestamp: new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        sender: (m.role === 'USER' ? 'user' : 'agent') as 'user' | 'agent',
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

  useEffect(() => {
    getAgentList().then((list) => {
      const agents = list.map((a) => ({ id: a.id, name: a.name, icon: a.avatar || '', persona: a.persona, model: a.model || '', temperature: a.temperature ?? 0.7 }))
      setAllAgents(agents)
      if (agents.length > 0) {
        setSelectedAgent(agents[0])
      }
    }).catch((err) => {
      console.error('加载智能体列表失败', err)
      message.error('加载智能体列表失败')
    })
  }, [])

  useEffect(() => {
    if (selectedAgent) {
      setConversationId(null)
      setMessages([])
      loadConversations({ autoOpenLatest: true })
    }
  }, [loadConversations, selectedAgent])

  const handleNewChat = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setConversationId(null)
    setMessages([])
    setSending(false)
  }

  const handleSelectConversation = async (convId: string) => {
    if (convId === conversationId) return
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setSending(false)
    try {
      await loadConversationMessages(convId)
    } catch (e) {
      console.error(e)
      message.error('加载对话详情失败')
    }
  }

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation()
    try {
      await deleteConversation(convId)
      if (convId === conversationId) {
        setConversationId(null)
        setMessages([])
      }
      loadConversations()
    } catch (err) {
      console.error(err)
      message.error('删除对话失败')
    }
  }

  useEffect(() => {
    return () => {
      if (selectedFile?.preview) {
        URL.revokeObjectURL(selectedFile.preview)
      }
    }
  }, [selectedFile])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = inputValue.trim()
    if (!text || sending || !selectedAgent) return

    const now = new Date()
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const newMessage: Message = {
      id: Date.now().toString(),
      text: text || '附带文件',
      timestamp,
      sender: 'user',
      agentName: selectedAgent.id !== '' ? selectedAgent.name : undefined,
    }

    if (selectedFile) {
      newMessage.fileName = selectedFile.file.name
      newMessage.filePreview = selectedFile.preview
      newMessage.fileIsImage = selectedFile.isImage
    }

    const agentMsgId = `agent-${Date.now()}`
    const agentMsg: Message = {
      id: agentMsgId,
      text: '',
      timestamp: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      sender: 'agent',
      agentName: selectedAgent.name,
    }

    setMessages((prev) => [...prev, newMessage, agentMsg])
    setInputValue('')
    handleFileRemove()
    setSending(true)

    const abortController = await runAgentStream(
      {
        agentId: selectedAgent.id,
        message: text,
        conversationId: conversationId ?? undefined,
        systemPrompt: selectedAgent.persona || undefined,
        model: selectedAgent.model || undefined,
        temperature: selectedAgent.temperature,
      },
      {
        onEvent: (event: RuntimeEvent) => {
          switch (event.type) {
            case 'run.created':
              if (!conversationId) {
                setConversationId(event.conversationId)
              }
              break

            case 'message.delta':
              setMessages((prev) =>
                prev.map((m) => (m.id === agentMsgId ? { ...m, text: m.text + event.content } : m))
              )
              break

            case 'message.completed':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, text: event.content, id: event.messageId } : m
                )
              )
              break

            case 'run.completed':
            case 'stream.done':
              setSending(false)
              abortRef.current = null
              loadConversations()
              break

            case 'run.failed':
              message.error(`运行失败: ${event.error}`)
              setSending(false)
              abortRef.current = null
              break

            case 'run.in_progress':
            case 'tool.call.created':
            case 'tool.call.completed':
              break

            default:
              break
          }
        },
        onError: (err) => {
          console.error(err)
          message.error('发送消息失败，请重试')
          setSending(false)
          abortRef.current = null
        },
      },
    )

    abortRef.current = abortController
  }

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
        </div>
        <div className={styles.centerChat}>
          {messages.length === 0 ? (
            <Empty className={styles.chatPlaceholder} description="准备大干一场吧" />
          ) : (
            <div className={styles.chatMessageList}>
              {messages.map((item) => {
                const isUser = item.sender === 'user'
                return (
                  <div key={item.id} className={`${styles.chatMessage} ${isUser ? styles.userRow : styles.agentRow}`}>
                    <div className={`${styles.messageContent} ${isUser ? styles.userBubble : styles.agentBubble}`}>

                      <span className={styles.messageText}>{item.text}</span>
                      {
                        item.fileName && item.filePreview && item.fileIsImage && (
                          <img src={item.filePreview} alt={item.fileName} className={styles.messageFile} />
                        )
                      }
                      {
                        item.fileName && !item.fileIsImage && (
                          <Tag className={styles.messageFileTag}>{item.fileName}</Tag>
                        )
                      }
                    </div>
                    <span className={styles.messageTime}>{item.timestamp}</span>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
        <div className={styles.leftSelect}>
          <Select
            className={styles.agentSelect}
            value={selectedAgent?.id}
            placeholder="选择智能体"
            notFoundContent={<Empty description="暂无智能体" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            onChange={(value) => {
              const agent = allAgents.find((a: { id: string; name: string; icon: string }) => a.id === String(value))
              if (agent) setSelectedAgent(agent)
            }}
            options={allAgents.map((agt: { id: string; name: string; icon: string }) => ({ value: agt.id, label: agt.name }))}
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
            onChange={handleFileChange} />
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
              autoSize={{ minRows: 1, maxRows: 6 }}
              variant="borderless"
            />
            <Button
              icon={<SendOutlined />}
              type="primary"
              shape="circle"
              onClick={sendMessage}
              loading={sending}
              disabled={sending}
              aria-label="发送信息"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
