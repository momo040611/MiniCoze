import React from 'react';
import type { AgentMode } from '../types';
import styles from '../agent-detail.module.css';
import { MODE_CONFIG } from '../constants';
import { ModeSelector } from '../../components/ModeSelector';

interface AgentDetailNavbarProps {
  agentName: string;
  agentAvatar: string;
  mode: AgentMode;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  autoSaveError: boolean;
  status: string;
  publishing: boolean;
  onBack: () => void;
  onEdit: () => void;
  onModeChange: (mode: AgentMode) => void;
  onSave: () => void;
  onPublish: () => void;
}

export function AgentDetailNavbar({
  agentName,
  agentAvatar,
  mode,
  saving,
  saved,
  dirty,
  autoSaveError,
  status,
  publishing,
  onBack,
  onEdit,
  onModeChange,
  onSave,
  onPublish,
}: AgentDetailNavbarProps) {
  const isPublished = status === 'ACTIVE';

  return (
    <div className={styles.navbar}>
      <div className={styles.navLeft}>
        <button className={styles.backArrow} onClick={onBack} title="返回">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <img src={agentAvatar} alt={agentName} className={styles.navAvatar} />
        <span className={styles.navName}>{agentName}</span>
        {!isPublished && (
          <button onClick={onEdit} className={styles.editBtn} title="编辑">✎</button>
        )}
        {isPublished && (
          <span className={styles.publishedBadge}>已发布</span>
        )}
      </div>
      <div className={styles.navCenter}>
        <ModeSelector
          currentMode={mode}
          modes={MODE_CONFIG}
          onModeChange={onModeChange}
        />
      </div>

      <div className={styles.navRight}>
        {autoSaveError && (
          <span className={styles.errorHint}>
            自动保存失败
          </span>
        )}
        {saved && <span className={styles.savedHint}>已保存</span>}
        {dirty && !saved && !autoSaveError && (
          <span className={styles.draftHint}>
            <span className={styles.draftDot} />
            草稿
          </span>
        )}
        {!isPublished && (
          <>
            <button
              className={styles.saveBtn}
              onClick={onSave}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              className={styles.publishBtn}
              onClick={onPublish}
              disabled={publishing}
            >
              {publishing ? '发布中...' : '发布'}
            </button>
          </>
        )}
        {isPublished && (
          <button
            className={styles.publishBtn}
            onClick={onPublish}
            disabled={publishing}
          >
            {publishing ? '下线中...' : '下线'}
          </button>
        )}
      </div>
    </div>
  );
}
