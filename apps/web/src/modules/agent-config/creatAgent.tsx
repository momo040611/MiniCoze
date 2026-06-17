import React, { useState, useCallback, useRef } from "react";
import styles from "./index.module.css";
import { uploadFile } from "../../api/files";
import { getCurrentWorkspaceId } from "../../api/workspace";

interface CreateAgentProps {
  visible: boolean;
  onCancel: () => void;
  onCreate: (agent: { name: string; avatar: string; description: string }) => void;
}

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='12' fill='%232563eb'/%3E%3Ctext x='24' y='30' text-anchor='middle' fill='white' font-size='20' font-family='Arial'%3E🤖%3C/text%3E%3C/svg%3E";
export function CreateAgent({ visible, onCancel, onCreate }: CreateAgentProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [avatarHover, setAvatarHover] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const uploadSeqRef = useRef(0);

  if (!visible) return null;

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 先用本地预览
    const localPreview = URL.createObjectURL(file);
    setAvatar(localPreview);

    setAvatarUploading(true);
    const seq = ++uploadSeqRef.current;
    try {
      const workspaceId = await getCurrentWorkspaceId();
      const uploaded = await uploadFile(file, 'AGENT_AVATAR', workspaceId);
      // 防止竞态：只有当前序列号匹配才更新
      if (uploadSeqRef.current !== seq) return;
      if (uploaded.url) {
        // 释放旧的 blob URL
        URL.revokeObjectURL(localPreview);
        setAvatar(uploaded.url);
      }
    } catch {
      if (uploadSeqRef.current !== seq) return;
      // 上传失败回退到默认头像
      URL.revokeObjectURL(localPreview);
      setAvatar(DEFAULT_AVATAR);
      alert('头像上传失败，请检查图片大小是否超过 5MB');
    } finally {
      if (uploadSeqRef.current === seq) {
        setAvatarUploading(false);
      }
    }
  }, [getCurrentWorkspaceId, uploadFile]);

  const handleCreate = useCallback(() => {
    if (!name.trim() || avatarUploading) return;
    onCreate({ name: name.trim(), avatar, description: description.trim() });
    setName("");
    setDescription("");
    setAvatar(DEFAULT_AVATAR);
  }, [name, avatar, description, avatarUploading, onCreate]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalDialog}>
        {/* 头部 */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>创建智能体</h2>
          <button className={styles.modalClose} onClick={onCancel}>
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className={styles.modalBody}>
          {/* 头像 */}
          <div className={styles.avatarSection}>
            <div
              className={styles.avatarWrapper}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
            >
              <img src={avatar} alt="avatar" className={styles.avatarImg} />
              <div className={`${styles.avatarOverlay} ${avatarHover ? styles.avatarOverlayShow : ""}`}>
                {avatarUploading ? (
                  <span className={styles.avatarHint}>上传中...</span>
                ) : (
                  <>
                    <span className={styles.cameraIcon}>📷</span>
                    <span className={styles.avatarHint}>更换头像</span>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className={styles.avatarInput}
                onChange={handleAvatarChange}
                disabled={avatarUploading}
              />
            </div>
          </div>

          {/* 名称 */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>
              智能体名称 <span className={styles.formRequired}>*</span>
            </label>
            <input
              className={styles.modalInput}
              type="text"
              placeholder="给你的智能体起个名字"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
            />
            <span className={styles.charCount}>{name.length}/30</span>
          </div>

          {/* 功能介绍 */}
          <div className={styles.modalField}>
            <label className={styles.modalLabel}>功能介绍</label>
            <textarea
              className={styles.modalTextarea}
              placeholder="描述智能体的功能和用途，帮助他人了解你的智能体"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={4}
            />
            <span className={styles.charCount}>{description.length}/200</span>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className={styles.modalFooter}>
          <button className={styles.modalCancelBtn} onClick={onCancel}>
            取消
          </button>
          <button
            className={styles.modalCreateBtn}
            onClick={handleCreate}
            disabled={!name.trim() || avatarUploading}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}