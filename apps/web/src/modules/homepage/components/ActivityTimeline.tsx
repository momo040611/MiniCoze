import { Skeleton, Result } from 'antd';
import {
  RobotOutlined,
  MessageOutlined,
  DeploymentUnitOutlined,
  ReloadOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { TimelineItem } from './shared/TimelineItem';
import { EmptyState } from './shared/EmptyState';
import type { ActivityItem } from '../../../api/dashboard';
import styles from './ActivityTimeline.module.css';

const TYPE_CFG: Record<string, { icon: React.ReactNode; iconBg: string; iconColor: string }> = {
  agent: {
    icon: <RobotOutlined />,
    iconBg: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.06))',
    iconColor: '#22c55e',
  },
  conversation: {
    icon: <MessageOutlined />,
    iconBg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.06))',
    iconColor: '#3b82f6',
  },
  workflow: {
    icon: <DeploymentUnitOutlined />,
    iconBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.06))',
    iconColor: '#f59e0b',
  },
};

interface Props {
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onNavigate: (path: string) => void;
}

export function ActivityTimeline({
  items,
  loading,
  error,
  hasMore,
  onRetry,
  onLoadMore,
  onNavigate,
}: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.dot} />
          <span className={styles.title}>最近动态</span>
          {items.length > 0 && (
            <span className={styles.badge}>{items.length}</span>
          )}
        </div>
      </div>

      <div className={styles.list}>
        {loading && (
          <div className={styles.stateWrap}>
            <Skeleton active paragraph={{ rows: 4 }} title={false} />
          </div>
        )}

        {!loading && error && (
          <div className={styles.stateWrap}>
            <Result
              status="warning"
              title="加载失败"
              subTitle={error}
              extra={
                <button onClick={onRetry} className={styles.retryBtn}>
                  <ReloadOutlined /> 重试
                </button>
              }
              style={{ padding: '8px 0' }}
            />
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={<RobotOutlined />}
            title="暂无活动记录"
            description="开始创建智能体、发起对话或运行工作流后，动态将显示在这里"
          />
        )}

        {!loading && !error && items.map((item) => {
          const cfg = TYPE_CFG[item.type] ?? TYPE_CFG.agent;
          return (
            <TimelineItem
              key={item.id}
              icon={cfg.icon}
              iconBg={cfg.iconBg}
              iconColor={cfg.iconColor}
              title={item.title}
              subtitle={item.subtitle}
              statusLabel={item.status}
              statusColor={item.statusColor}
              timestamp={item.relativeTime}
              onClick={() => onNavigate(item.targetPath)}
            />
          );
        })}
      </div>

      {!loading && !error && hasMore && (
        <button className={styles.loadMore} onClick={onLoadMore}>
          <DownOutlined /> 加载更多
        </button>
      )}
    </div>
  );
}
