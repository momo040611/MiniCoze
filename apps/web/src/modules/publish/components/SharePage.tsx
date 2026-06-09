// 公开分享聊天页面 — /share/agents/:slug
// 对接后端 POST /public/agents/:slug/chat/stream (SSE)

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { message, Button, Avatar } from 'antd';
import {
  CopyOutlined,
  SendOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  UserOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { getPublicAgent, runPublicAgentStream, type PublicAgentInfo } from '../api';
import type { RuntimeEvent, MessageDeltaEvent } from '../../../api/agent-runtime/index';
import { MarkdownRenderer } from '../../homepage/components/chat/MarkdownRenderer';
import styles from '../index.module.css';

// ==================== 类型 ====================

type MessageStatus = 'sending' | 'streaming' | 'success' | 'failed';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent';
  status: MessageStatus;
  time: string;
  errorText?: string;
}

// ==================== visitorId 持久化 ====================

function getVisitorId(): string {
  const key = 'public_agent_visitor_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

// ==================== 工具函数 ====================

function formatTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function StatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'sending':
      return <LoadingOutlined className={`${styles.shareStatusIcon} ${styles.shareStatusSending}`} />;
    case 'streaming':
      return <LoadingOutlined spin className={`${styles.shareStatusIcon} ${styles.shareStatusStreaming}`} />;
    case 'success':
      return <CheckCircleFilled className={`${styles.shareStatusIcon} ${styles.shareStatusSuccess}`} />;
    case 'failed':
      return <CloseCircleFilled className={`${styles.shareStatusIcon} ${styles.shareStatusFailed}`} />;
  }
}

// ==================== 主组件 ====================

export function SharePage() {
  const { slug } = useParams<{ slug: string }>();
  const visitorId = useRef(getVisitorId());

  const [agent, setAgent] = useState<PublicAgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 加载智能体信息
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setLoadError(null);
    getPublicAgent(slug)
      .then(setAgent)
      .catch((err) => setLoadError(err?.message ?? '加载失败'))
      .finally(() => setLoading(false));

    return () => abortRef.current?.abort();
  }, [slug]);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 组件卸载
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // ---- 发送消息 ----
  const doSend = useCallback(
    (text: string) => {
      if (!slug || sendingRef.current) return;

      sendingRef.current = true;
      setSending(true);

      const timeStr = formatTime();

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        text,
        sender: 'user',
        time: timeStr,
        status: 'success',
      };

      const agentMsgId = `agent-${Date.now()}`;
      const agentMsg: ChatMessage = {
        id: agentMsgId,
        text: '',
        sender: 'agent',
        time: timeStr,
        status: 'sending',
      };

      setMessages((prev) => [...prev, userMsg, agentMsg]);
      setInputValue('');

      runPublicAgentStream(
        {
          slug: slug!,
          message: text,
          conversationId: conversationId ?? undefined,
          visitorId: visitorId.current,
        },
        {
          onEvent: (event: RuntimeEvent) => {
            switch (event.type) {
              case 'run.created':
                setConversationId(event.conversationId);
                break;

              case 'run.in_progress':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId ? { ...m, status: 'streaming' as const } : m,
                  ),
                );
                break;

              case 'message.delta':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? { ...m, text: m.text + (event as MessageDeltaEvent).content, status: 'streaming' as const }
                      : m,
                  ),
                );
                break;

              case 'message.completed':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? { ...m, text: event.content, id: event.messageId, status: 'success' as const }
                      : m,
                  ),
                );
                break;

              case 'run.failed':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMsgId
                      ? { ...m, status: 'failed' as const, errorText: event.error || '请求失败' }
                      : m,
                  ),
                );
                sendingRef.current = false;
                setSending(false);
                abortRef.current = null;
                break;

              case 'stream.done':
                sendingRef.current = false;
                setSending(false);
                abortRef.current = null;
                break;
            }
          },
          onError: (err) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === agentMsgId
                  ? { ...m, status: 'failed' as const, errorText: err.message }
                  : m,
              ),
            );
            sendingRef.current = false;
            setSending(false);
            abortRef.current = null;
          },
        },
      ).then((controller) => {
        abortRef.current = controller;
      });
    },
    [slug, conversationId],
  );

  // ---- 发送处理 ----
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    doSend(text);
  }, [inputValue, doSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---- 一键复制分享链接 ----
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(
      () => message.success('分享链接已复制到剪贴板'),
      () => message.error('复制失败'),
    );
  };

  // ---- 渲染消息 ----
  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.sender === 'user';

    return (
      <div key={msg.id} className={`${styles.shareBubble} ${isUser ? styles.shareBubbleUser : ''}`}>
        {/* 头像 */}
        {isUser ? (
          <Avatar size={30} icon={<UserOutlined />} style={{ flexShrink: 0, background: '#1677ff' }} />
        ) : (
          <Avatar
            size={30}
            src={agent?.avatarUrl}
            icon={<RobotOutlined />}
            style={{ flexShrink: 0 }}
          />
        )}

        {/* 消息内容 */}
        <div className={styles.shareBubbleContent}>
          <div className={isUser ? styles.shareBubbleText : undefined}>
            {isUser ? (
              msg.text
            ) : msg.status === 'success' ? (
              <MarkdownRenderer content={msg.text} />
            ) : (
              <div className={styles.shareBubbleText}>
                {msg.text ||
                  (msg.status === 'sending'
                    ? '发送中...'
                    : msg.status === 'streaming'
                      ? '思考中...'
                      : msg.status === 'failed'
                        ? msg.errorText || '请求失败，请稍后重试'
                        : '')}
              </div>
            )}
          </div>
          <div className={styles.shareBubbleMeta}>
            <span className={styles.shareBubbleTime}>{msg.time}</span>
            <StatusIcon status={msg.status} />
          </div>
        </div>
      </div>
    );
  };

  // ---- 加载状态 ----
  if (loading) {
    return (
      <div className={styles.sharePage}>
        <div className={styles.shareEmpty}>
          <LoadingOutlined style={{ fontSize: 32, color: '#1677ff' }} />
          <p style={{ color: '#7b8ba3', marginTop: 16, fontSize: 14 }}>正在加载智能体...</p>
        </div>
      </div>
    );
  }

  // ---- 加载失败 ----
  if (loadError || !agent) {
    return (
      <div className={styles.sharePage}>
        <div className={styles.shareEmpty}>
          <CloseCircleFilled style={{ fontSize: 48, color: '#dc2626' }} />
          <h1 style={{ color: '#12294a', marginTop: 16, marginBottom: 8 }}>无法访问</h1>
          <p style={{ color: '#7b8ba3', fontSize: 14, maxWidth: 360, lineHeight: 1.6 }}>
            {loadError || '未找到该智能体，请检查分享链接是否正确'}
          </p>
        </div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  // ---- 主界面 ----
  return (
    <div className={styles.sharePage}>
      {/* 顶栏 */}
      <div className={styles.shareTopBar}>
        <div className={styles.shareAgentInfo}>
          <Avatar size={36} src={agent.avatarUrl} icon={<RobotOutlined />} shape="square" />
          <div>
            <div className={styles.shareName}>{agent.name}</div>
            {agent.description && (
              <div className={styles.shareDesc}>{agent.description}</div>
            )}
          </div>
        </div>

        <button className={styles.shareCopyBtn} onClick={handleCopyLink}>
          <CopyOutlined />
          <span>复制分享链接</span>
        </button>
      </div>

      {/* 聊天区域 */}
      <div className={styles.shareChatArea}>
        {hasMessages ? (
          <div className={styles.shareMessages}>
            {messages.map(renderMessage)}
            <div ref={chatEndRef} />
          </div>
        ) : (
          <div className={styles.shareEmpty}>
            <Avatar size={72} src={agent.avatarUrl} icon={<RobotOutlined />} shape="square" style={{ marginBottom: 16 }} />
            <div className={styles.shareEmptyName}>{agent.name}</div>
            {agent.description && (
              <div className={styles.shareEmptyDesc}>{agent.description}</div>
            )}
            {agent.openingMessage && (
              <div className={styles.shareOpeningMsg}>
                <MarkdownRenderer content={agent.openingMessage} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入栏 */}
      <div className={styles.shareInputBar}>
        <textarea
          className={styles.shareInput}
          placeholder={`向 ${agent.name} 发送消息...`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={1}
        />
        <button
          className={styles.shareSendBtn}
          onClick={handleSend}
          disabled={sending || !inputValue.trim()}
          title="发送"
        >
          {sending ? <LoadingOutlined /> : <SendOutlined />}
        </button>
      </div>

      {/* 页脚 */}
      <div className={styles.shareFooter}>Powered by MiniCoze</div>
    </div>
  );
}
