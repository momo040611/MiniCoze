// Dashboard 区块通用容器 — 统一处理 loading / error / empty 状态
import { Skeleton, Result } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import styles from '../../dashboard.module.css';

export type SectionState = 'loading' | 'data' | 'empty' | 'error';

interface Props {
  state: SectionState;
  title: string;
  dotColor?: string;
  dotClass?: string;
  badge?: number;
  action?: { label: string; onClick: () => void };
  errorMsg?: string;
  onRetry?: () => void;
  emptyText?: string;
  emptyAction?: { label: string; onClick: () => void };
  children: React.ReactNode;
}

export function SectionCard({
  state, title, dotColor, dotClass, badge, action,
  errorMsg, onRetry, emptyText, emptyAction, children,
}: Props) {
  return (
    <div className={styles.sectionPanel}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderLeft}>
          {dotClass ? (
            <span className={`${styles.sectionDot} ${styles[dotClass] || ''}`} />
          ) : dotColor ? (
            <span className={styles.sectionDot} style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}66` }} />
          ) : null}
          <span className={styles.sectionTitle}>{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className={styles.sectionBadge}>{badge}</span>
          )}
        </div>
        {action && (
          <button className={styles.sectionMore} onClick={action.onClick}>
            {action.label} →
          </button>
        )}
      </div>
      <div className={styles.sectionList}>
        {state === 'loading' && (
          <div style={{ padding: '12px 22px' }}>
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          </div>
        )}
        {state === 'error' && (
          <div style={{ padding: '16px 22px', textAlign: 'center' }}>
            <Result
              status="warning"
              title={errorMsg || '加载失败'}
              subTitle="请检查网络连接后重试"
              extra={onRetry && (
                <button onClick={onRetry} className={styles.emptySecondaryBtn} style={{ fontSize: 13, padding: '6px 16px' }}>
                  <ReloadOutlined /> 重试
                </button>
              )}
              style={{ padding: '8px 0' }}
            />
          </div>
        )}
        {state === 'empty' && (
          <div className={styles.sectionEmpty}>
            <p style={{ margin: '0 0 12px' }}>{emptyText || '暂无数据'}</p>
            {emptyAction && (
              <button onClick={emptyAction.onClick} className={styles.emptyPrimaryBtn} style={{ fontSize: 13, padding: '6px 16px' }}>
                + {emptyAction.label}
              </button>
            )}
          </div>
        )}
        {state === 'data' && children}
      </div>
    </div>
  );
}
