// 通用时间线条目 — 用于 ActivityTimeline 和 LogPreview
import { useCallback } from 'react';
import styles from './TimelineItem.module.css';

export interface TimelineItemProps {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusColor?: string;
  timestamp: string;
  onClick?: () => void;
}

export function TimelineItem({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  statusLabel,
  statusColor,
  timestamp,
  onClick,
}: TimelineItemProps) {
  const handleClick = useCallback(() => onClick?.(), [onClick]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
    },
    [onClick],
  );

  const isClickable = !!onClick;

  return (
    <div
      className={`${styles.item} ${isClickable ? styles.clickable : ''}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      aria-label={title}
    >
      <div
        className={styles.iconWrap}
        style={iconBg || iconColor ? {
          background: iconBg ?? undefined,
          color: iconColor ?? undefined,
        } : undefined}
      >
        {icon}
      </div>
      <div className={styles.info}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{title}</span>
          {statusLabel && (
            <span
              className={styles.statusTag}
              style={{ background: `${statusColor ?? '#6b7280'}18`, color: statusColor ?? '#6b7280' }}
            >
              {statusLabel}
            </span>
          )}
        </div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      <span className={styles.time}>{timestamp}</span>
    </div>
  );
}
