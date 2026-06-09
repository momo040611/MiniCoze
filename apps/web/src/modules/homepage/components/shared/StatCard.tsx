
import { useCallback } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import styles from './StatCard.module.css';

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  accentColor: string;
  targetPath: string;
  onClick: (path: string) => void;
  onCreate?: () => void;
  'aria-label'?: string;
}

export function StatCard({
  icon,
  label,
  value,
  accentColor,
  targetPath,
  onClick,
  onCreate,
  'aria-label': ariaLabel,
}: StatCardProps) {
  const handleClick = useCallback(() => onClick(targetPath), [onClick, targetPath]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(targetPath);
      }
    },
    [onClick, targetPath],
  );

  const handleCreate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCreate?.();
    },
    [onCreate],
  );

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel ?? `${label}: ${value}个`}
    >
      <div className={styles.header}>
        <div
          className={styles.iconWrap}
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}
        >
          {icon}
        </div>
        {onCreate && (
          <button
            className={styles.createBtn}
            onClick={handleCreate}
            aria-label={`新建${label}`}
            title={`新建${label}`}
          >
            <PlusOutlined />
          </button>
        )}
      </div>
      <div className={styles.body}>
        <span className={styles.value}>{value}</span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
