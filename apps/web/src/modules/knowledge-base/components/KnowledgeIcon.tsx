import type { KnowledgeIconType } from '../../../api/knowledge-base';
import styles from '../document/document.module.css';

type KnowledgeIconValue = {
  icon?: string;
  iconType?: KnowledgeIconType;
  iconImageUrl?: string;
};

type KnowledgeIconProps = {
  value: KnowledgeIconValue;
  size?: 'card' | 'large';
};

function getKnowledgeIconText(value: KnowledgeIconValue) {
  return value.icon?.trim() || '📘';
}

function KnowledgeIcon({ value, size = 'card' }: KnowledgeIconProps) {
  const isImage = value.iconType === 'image' && Boolean(value.iconImageUrl);
  return (
    <div className={`${styles.iconBox} ${size === 'large' ? styles.iconBoxLarge : ''}`}>
      {isImage ? (
        <img alt="知识库图标" className={styles.iconImage} src={value.iconImageUrl} />
      ) : (
        <span>{getKnowledgeIconText(value)}</span>
      )}
    </div>
  );
}

export { KnowledgeIcon, type KnowledgeIconValue };
