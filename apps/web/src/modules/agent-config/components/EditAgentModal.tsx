import React, { useState, useEffect, useCallback } from 'react';
import styles from './EditAgentModal.module.css';
import { updateAgent } from '../../../api/agent-config/index';

interface Props {
  visible: boolean;
  agentId: string;
  name: string;
  description: string;
  avatar: string;
  onCancel: () => void;
  onSaved: () => void;
}

export function EditAgentModal({
  visible,
  agentId,
  name: initialName,
  description: initialDescription,
  avatar: initialAvatar,
  onCancel,
  onSaved,
}: Props) {
  const [editName, setEditName] = useState(initialName);
  const [editDescription, setEditDescription] = useState(initialDescription);
  const [editAvatar, setEditAvatar] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setEditName(initialName);
      setEditDescription(initialDescription);
      setEditAvatar(initialAvatar);
    }
  }, [visible, initialName, initialDescription, initialAvatar]);

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEditAvatar((ev.target?.result as string) || initialAvatar);
      };
      reader.readAsDataURL(file);
    }
  }, [initialAvatar]);

  const handleSave = useCallback(async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateAgent(agentId, {
        name: editName.trim(),
        description: editDescription.trim(),
        avatar: editAvatar,
      });
      onSaved();
    } catch {
      alert('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }, [agentId, editName, editDescription, editAvatar, onSaved]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.dialog}>
        {/* --- 标题栏 --- */}
        <div className={styles.header}>
          <h2 className={styles.title}>编辑智能体</h2>
          <button className={styles.closeBtn} onClick={onCancel}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* --- 头像 --- */}
        <div className={styles.body}>
          <div className={styles.avatarSection}>
            <label className={styles.avatarLabel}>
              <img src={editAvatar} alt="avatar" className={styles.avatarImg} />
              <div className={styles.avatarHint}>点击更换头像</div>
              <input
                type="file"
                accept="image/*"
                className={styles.avatarInput}
                onChange={handleAvatarChange}
              />
            </label>
          </div>

          {/* --- 名称 --- */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              智能体名称 <span className={styles.required}>*</span>
            </label>
            <input
              className={styles.fieldInput}
              type="text"
              placeholder="给你的智能体起个名字"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={30}
            />
            <span className={styles.charCount}>{editName.length}/30</span>
          </div>

          {/* --- 功能介绍 --- */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>功能介绍</label>
            <textarea
              className={styles.fieldTextarea}
              placeholder="描述智能体的功能和用途"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              maxLength={200}
              rows={4}
            />
            <span className={styles.charCount}>{editDescription.length}/200</span>
          </div>
        </div>

        {/* --- 底部按钮 --- */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            取消
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || !editName.trim()}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
