// 公开分享聊天页面 — /share/agents/:slug
// 对接后端 POST /public/agents/:slug/chat/stream (SSE)

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { message, Button, Avatar } from 'antd';
import {
  PaperClipOutlined,
  CloseOutlined,
  CopyOutlined,
  SendOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  UserOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import {
  getPublicAgent,
  runPublicAgentStream,
  uploadPublicChatAttachment,
  type PublicAgentInfo,
} from '../api';
import type { UploadedFileAsset } from '../../../api/files';
import type { RuntimeEvent, MessageDeltaEvent } from '../../../api/agent-runtime/index';
import { formatFileSize } from '../../homepage/utils/format';
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
  attachments?: ChatMessageAttachment[];
  errorText?: string;
}

interface ChatMessageAttachment {
  fileId?: string;
  name: string;
  mimeType: string;
  size: number;
  sizeText: string;
  preview?: string;
  isImage: boolean;
}

interface SelectedAttachment {
  file: File;
  preview: string;
  isImage: boolean;
  size: string;
  uploadStatus: 'uploading' | 'success' | 'failed';
  uploadedFile?: UploadedFileAsset;
  errorText?: string;
}

const CHAT_ATTACHMENT_ACCEPT = 'image/png,image/jpg,image/jpeg,image/gif,image/webp,.txt,.md';
const SUPPORTED_TEXT_EXTENSIONS = new Set(['txt', 'md']);
const SUPPORTED_TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
]);

function isSupportedChatAttachment(file: File) {
  if (file.type.startsWith('image/')) return true;
  if (SUPPORTED_TEXT_MIME_TYPES.has(file.type)) return true;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension ? SUPPORTED_TEXT_EXTENSIONS.has(extension) : false;
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
  const [selectedFile, setSelectedFile] = useState<SelectedAttachment | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSeqRef = useRef(0);
  const selectedFileRef = useRef<SelectedAttachment | null>(null);
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

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (selectedFileRef.current?.preview) {
        URL.revokeObjectURL(selectedFileRef.current.preview);
      }
    };
  }, []);

  // ---- 发送消息 ----
  const doSend = useCallback(
    (text: string, attachments: ChatMessageAttachment[] = []) => {
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
        attachments,
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
          attachments: attachments
            .filter((item) => item.fileId)
            .map((item) => ({
              fileId: item.fileId!,
              name: item.name,
              mimeType: item.mimeType,
              size: item.size,
            })),
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
    if (selectedFile?.uploadStatus === 'uploading') {
      message.warning('附件上传中，请稍后再发送');
      return;
    }
    if (selectedFile?.uploadStatus === 'failed') {
      message.error(selectedFile.errorText ?? '附件上传失败，请删除后重新选择');
      return;
    }
    const attachments: ChatMessageAttachment[] =
      selectedFile?.uploadStatus === 'success' && selectedFile.uploadedFile
        ? [
            {
              fileId: selectedFile.uploadedFile.id,
              name: selectedFile.uploadedFile.originalName,
              mimeType: selectedFile.uploadedFile.mimeType,
              size: selectedFile.uploadedFile.size,
              sizeText: selectedFile.size,
              preview: selectedFile.preview,
              isImage: selectedFile.isImage,
            },
          ]
        : [];
    doSend(text, attachments);
    uploadSeqRef.current += 1;
    setSelectedFile(null);
  }, [inputValue, doSend, selectedFile]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---- 一键复制分享链接 ----
  const uploadSelectedFile = useCallback(async (file: File) => {
    if (!slug) return;

    const isImage = file.type.startsWith('image/');
    const preview = isImage ? URL.createObjectURL(file) : '';
    const size = formatFileSize(file.size);

    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview);
    }

    const uploadSeq = uploadSeqRef.current + 1;
    uploadSeqRef.current = uploadSeq;

    if (!isSupportedChatAttachment(file)) {
      if (preview) URL.revokeObjectURL(preview);
      message.error('当前公开聊天附件仅支持图片和 txt/md 文本');
      setSelectedFile(null);
      return;
    }

    setSelectedFile({
      file,
      preview,
      isImage,
      size,
      uploadStatus: 'uploading',
    });

    try {
      const uploadedFile = await uploadPublicChatAttachment(slug, file);
      if (uploadSeqRef.current !== uploadSeq) return;
      setSelectedFile({
        file,
        preview,
        isImage,
        size,
        uploadStatus: 'success',
        uploadedFile,
      });
    } catch (error) {
      if (uploadSeqRef.current !== uploadSeq) return;
      setSelectedFile({
        file,
        preview,
        isImage,
        size,
        uploadStatus: 'failed',
        errorText: error instanceof Error ? error.message : '附件上传失败',
      });
    }
  }, [selectedFile, slug]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    void uploadSelectedFile(file);
  };

  const handleFileRemove = () => {
    uploadSeqRef.current += 1;
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview);
    }
    setSelectedFile(null);
  };

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
          {isUser && msg.attachments && msg.attachments.length > 0 && (
            <div className={styles.shareAttachments}>
              {msg.attachments.map((attachment) => (
                <div
                  key={attachment.fileId ?? attachment.name}
                  className={styles.shareAttachment}
                >
                  {attachment.isImage && attachment.preview ? (
                    <img
                      src={attachment.preview}
                      alt={attachment.name}
                      className={styles.shareAttachmentThumb}
                    />
                  ) : (
                    <span className={styles.shareAttachmentIcon}>TXT</span>
                  )}
                  <div className={styles.shareAttachmentInfo}>
                    <span className={styles.shareAttachmentName}>
                      {attachment.name}
                    </span>
                    <span className={styles.shareAttachmentSize}>
                      {attachment.sizeText}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
        {selectedFile && (
          <div className={styles.shareFilePreviewBar}>
            {selectedFile.isImage ? (
              <img
                src={selectedFile.preview}
                alt={selectedFile.file.name}
                className={styles.shareFilePreviewThumb}
              />
            ) : (
              <span className={styles.shareFileDocIcon}>TXT</span>
            )}
            <div className={styles.shareFilePreviewInfo}>
              <span className={styles.shareFilePreviewName}>
                {selectedFile.file.name}
              </span>
              <span className={styles.shareFilePreviewSize}>
                {selectedFile.size}
                {' · '}
                {selectedFile.uploadStatus === 'uploading'
                  ? '上传中'
                  : selectedFile.uploadStatus === 'success'
                    ? '已上传'
                    : (selectedFile.errorText ?? '上传失败')}
              </span>
            </div>
            <button
              type="button"
              className={styles.shareFileRemoveBtn}
              onClick={handleFileRemove}
              aria-label="删除附件"
            >
              <CloseOutlined />
            </button>
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          accept={CHAT_ATTACHMENT_ACCEPT}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div className={styles.shareInputRow}>
        <button
          type="button"
          className={styles.shareAttachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || selectedFile?.uploadStatus === 'uploading'}
          aria-label="上传文件"
        >
          <PaperClipOutlined />
        </button>
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
          disabled={
            sending ||
            !inputValue.trim() ||
            selectedFile?.uploadStatus === 'uploading' ||
            selectedFile?.uploadStatus === 'failed'
          }
          title="发送"
        >
          {sending ? <LoadingOutlined /> : <SendOutlined />}
        </button>
        </div>
      </div>

      {/* 页脚 */}
      <div className={styles.shareFooter}>Powered by MiniCoze</div>
    </div>
  );
}
