
import { useCallback } from 'react';
import type { QuickAction } from '../../../api/dashboard';
import styles from './SidePanel.module.css';

interface Props {
  items: QuickAction[];
  onClick: (path: string) => void;
}

export function QuickCreate({ items, onClick }: Props) {
  return (
    <div className={styles.subSection}>
      <div className={styles.subTitle}>快捷创建</div>
      <div className={styles.quickList}>
        {items.map((item) => (
          <QuickCreateItem key={item.key} item={item} onClick={onClick} />
        ))}
      </div>
    </div>
  );
}

function QuickCreateItem({ item, onClick }: { item: QuickAction; onClick: (path: string) => void }) {
  const handleClick = useCallback(() => onClick(item.targetPath), [onClick, item.targetPath]);

  return (
    <button className={styles.quickItem} onClick={handleClick} aria-label={item.label}>
      <div className={styles.quickIcon}>{item.icon}</div>
      <div className={styles.quickInfo}>
        <span className={styles.quickLabel}>{item.label}</span>
        <span className={styles.quickDesc}>{item.description}</span>
      </div>
    </button>
  );
}
