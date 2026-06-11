import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, Tag } from 'antd';
import {
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  CloseOutlined,
  LoadingOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import type { OpeningConfig } from '../agent-detail';
import { ChatAttachmentList } from '../../chat/components/ChatAttachmentList';
import { useAgentChat } from '../../chat/hooks/useAgentChat';
import {
  CHAT_ATTACHMENT_ACCEPT,
  useChatAttachments,
} from '../../chat/hooks/useChatAttachments';
import type {
  ChatMessage,
  DebugMessage,
  KnowledgeMessage,
  ToolCallMessage,
} from '../../chat/types';
import { DebugInfoPanel } from './DebugInfoPanel';
import { KnowledgeStatus } from './KnowledgeStatus';
import { ToolCallCard } from './ToolCallCard';
import styles from './PreviewChat.module.css';

interface Props {
  agentId: string;
  agentName: string;
  avatar: string;
  persona: string;
  model: string;
  temperature: number;
  openingConfig: OpeningConfig;
  knowledgeBaseId?: string;
}

const STORAGE_PREFIX = 'preview_chat_';

function renderStatusIcon(status: ChatMessage['status']) {
  switch (status) {
    case 'sending':
      return <LoadingOutlined style={{ fontSize: 12, color: '#6b7280' }} />;
    case 'streaming':
      return <LoadingOutlined spin style={{ fontSize: 12, color: '#7c3aed' }} />;
    case 'success':
      return <CheckCircleFilled style={{ fontSize: 12, color: '#22c55e' }} />;
    case 'failed':
      return <CloseCircleFilled style={{ fontSize: 12, color: '#ef4444' }} />;
  }
}

export function PreviewChat({
  agentId,
  agentName,
  avatar,
  persona,
  model,
  temperature,
  openingConfig,
  knowledgeBaseId,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [knowledgeDismissed, setKnowledgeDismissed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    selectedAttachment,
    readyAttachments,
    selectFile,
    clearAttachments,
    uploading,
    failed: attachmentFailed,
  } = useChatAttachments();
  const {
    items,
    conversationId,
    sending,
    knowledgeEvent,
    sendMessage,
    loadConversation,
    startNewConversation,
    deleteCurrentConversation,
  } = useAgentChat({
    agentId,
    preview: true,
    model,
    systemPrompt: persona,
    temperature,
    knowledgeBaseId,
    agentName,
    agentIcon: avatar,
    appendKnowledgeItems: true,
    appendDebugItems: true,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  useEffect(() => {
    const storageKey = STORAGE_PREFIX + agentId;
    const cachedConversationId = sessionStorage.getItem(storageKey);
    startNewConversation();
    clearAttachments();
    setInputValue('');
    setKnowledgeDismissed(false);

    if (cachedConversationId) {
      void loadConversation(cachedConversationId).catch(() => {
        sessionStorage.removeItem(storageKey);
        startNewConversation();
      });
    }
  }, [agentId, clearAttachments, loadConversation, startNewConversation]);

  useEffect(() => {
    const storageKey = STORAGE_PREFIX + agentId;
    if (conversationId) sessionStorage.setItem(storageKey, conversationId);
    else sessionStorage.removeItem(storageKey);
  }, [agentId, conversationId]);

  const doSend = useCallback(async (text: string) => {
    const normalized = text.trim();
    if (!normalized || uploading || attachmentFailed) return;
    const sent = await sendMessage({ content: normalized, attachments: readyAttachments });
    if (sent) {
      setInputValue('');
      clearAttachments();
      setKnowledgeDismissed(false);
    }
  }, [attachmentFailed, clearAttachments, readyAttachments, sendMessage, uploading]);

  const handleClear = useCallback(async () => {
    clearAttachments();
    setInputValue('');
    setKnowledgeDismissed(false);
    sessionStorage.removeItem(STORAGE_PREFIX + agentId);
    await deleteCurrentConversation();
  }, [agentId, clearAttachments, deleteCurrentConversation]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void selectFile(file);
  }, [selectFile]);

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.sender === 'user';
    return (
      <div
        key={message.id}
        className={`${styles.previewBubble} ${isUser ? styles.previewBubbleUser : ''}`}
      >
        {!isUser && <img src={avatar} alt='' className={styles.previewAvatarSmall} />}
        <div style={{ maxWidth: '80%', minWidth: 0, flex: isUser ? undefined : 1 }}>
          <ChatAttachmentList
            attachments={message.attachments}
            listClassName={styles.messageAttachments}
            itemClassName={styles.messageAttachment}
            imageClassName={styles.messageAttachmentThumb}
            iconClassName={styles.messageAttachmentIcon}
            infoClassName={styles.messageAttachmentInfo}
            nameClassName={styles.messageAttachmentName}
            sizeClassName={styles.messageAttachmentSize}
          />
          <div className={styles.previewMsg}>
            {message.text ||
              (message.status === 'sending'
                ? '准备中...'
                : message.status === 'streaming'
                  ? '思考中...'
                  : message.status === 'failed'
                    ? message.errorText || '请求失败'
                    : '无法获取回复')}
          </div>
          <div className={styles.previewMeta}>
            <span>{message.time}</span>
            {renderStatusIcon(message.status)}
          </div>
        </div>
      </div>
    );
  };

  const renderItem = (item: typeof items[number]) => {
    switch (item.kind) {
      case 'message':
        return renderMessage(item);
      case 'tool-call':
        return (
          <div key={item.id} style={{ paddingLeft: 38, marginBottom: 4 }}>
            <ToolCallCard data={(item as ToolCallMessage).toolData} />
          </div>
        );
      case 'knowledge':
        if (knowledgeDismissed) return null;
        return (
          <div key={item.id} style={{ paddingLeft: 38, marginBottom: 4 }}>
            <KnowledgeStatus
              knowledgeEvent={(item as KnowledgeMessage).knowledgeEvent}
              onClose={() => setKnowledgeDismissed(true)}
            />
          </div>
        );
      case 'debug': {
        const debug = item as DebugMessage;
        return (
          <div key={item.id} style={{ paddingLeft: 38, marginBottom: 4 }}>
            <DebugInfoPanel
              runId={debug.runId}
              model={debug.model}
              latency={debug.latency}
              usage={debug.usage}
              toolCalls={debug.toolCalls}
            />
          </div>
        );
      }
      case 'error':
        return null;
    }
  };

  const showKnowledgeHint = !knowledgeBaseId && !knowledgeEvent;

  return (
    <div className={styles.previewBox}>
      <div className={styles.previewToolbar}>
        <span className={styles.previewToolbarText}>预览与调试</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {model && <Tag color='purple' style={{ margin: 0, fontSize: 11 }}>{model}</Tag>}
          <button
            className={styles.previewClearBtn}
            type='button'
            onClick={() => void handleClear()}
            disabled={items.length === 0 && !conversationId}
          >
            清除
          </button>
        </div>
      </div>

      {showKnowledgeHint && !knowledgeDismissed && (
        <div style={{ padding: '8px 14px', background: '#fffbeb', borderBottom: '1px solid rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#92400e' }}>
          <BookOutlined style={{ color: '#f59e0b' }} />
          未绑定知识库，调试时无法进行知识召回。
        </div>
      )}

      <div className={styles.previewChat}>
        {openingConfig.openingMessage && items.length === 0 && (
          <div className={styles.previewBubble}>
            <img src={avatar} alt='' className={styles.previewAvatarSmall} />
            <div className={styles.previewMsg}>{openingConfig.openingMessage}</div>
          </div>
        )}
        {openingConfig.openingQuestionsEnabled && items.length === 0 && (
          <div className={styles.openingQuestions}>
            {(openingConfig.openingQuestions ?? []).map((question) => (
              <span key={question} onClick={() => void doSend(question)}>
                {question}
              </span>
            ))}
          </div>
        )}
        {items.map(renderItem)}
        <div ref={chatEndRef} />
      </div>

      {selectedAttachment && (
        <div className={styles.filePreviewBar}>
          {selectedAttachment.isImage && selectedAttachment.previewUrl ? (
            <img src={selectedAttachment.previewUrl} alt={selectedAttachment.file.name} className={styles.filePreviewThumb} />
          ) : (
            <span className={styles.previewDocIcon}>TXT</span>
          )}
          <div className={styles.filePreviewInfo}>
            <span className={styles.filePreviewName}>{selectedAttachment.file.name}</span>
            <span className={styles.filePreviewSize}>
              {selectedAttachment.sizeText} · {selectedAttachment.uploadStatus === 'uploading' ? '上传中' : selectedAttachment.uploadStatus === 'success' ? '已上传' : selectedAttachment.errorText ?? '上传失败'}
            </span>
          </div>
          <Button icon={<CloseOutlined />} size='small' type='text' danger onClick={clearAttachments} />
        </div>
      )}

      <input
        type='file'
        ref={fileInputRef}
        accept={CHAT_ATTACHMENT_ACCEPT}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div className={styles.previewInputRow}>
        <Button
          icon={<PaperClipOutlined />}
          type='text'
          onClick={() => fileInputRef.current?.click()}
          className={styles.previewAttachBtn}
          disabled={sending || uploading}
        />
        <input
          className={styles.previewInput}
          placeholder='输入消息调试智能体...'
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) void doSend(inputValue);
          }}
          disabled={sending}
        />
        <button
          className={styles.previewSendBtn}
          onClick={() => void doSend(inputValue)}
          disabled={sending || uploading || attachmentFailed}
        >
          {sending ? '等待...' : uploading ? '上传中' : '发送'}
        </button>
      </div>
    </div>
  );
}
