// 最近工作流运行记录区块
import { Tag } from 'antd';
import { DeploymentUnitOutlined, CheckCircleFilled, LoadingOutlined, CloseCircleFilled } from '@ant-design/icons';
import { SectionCard } from './SectionCard';
import type { SectionState } from './SectionCard';
import type { DashboardWorkflowRun } from '../../../../api/dashboard';
import styles from '../../dashboard.module.css';

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  running: { label: '运行中', color: 'processing', icon: <LoadingOutlined spin /> },
  success: { label: '成功', color: 'success', icon: <CheckCircleFilled /> },
  failed: { label: '失败', color: 'error', icon: <CloseCircleFilled /> },
};

function fmtDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

interface Props {
  state: SectionState;
  items: DashboardWorkflowRun[];
  onGo: (path: string) => void;
  onRetry?: () => void;
}

export function RecentWorkflowsSection({ state, items, onGo, onRetry }: Props) {
  return (
    <SectionCard
      state={state}
      title="最近工作流运行"
      dotColor="#f59e0b"
      badge={items.length}
      action={{ label: '查看全部', onClick: () => onGo('/workflows') }}
      errorMsg="工作流数据加载失败"
      onRetry={onRetry}
      emptyText="暂无工作流运行记录"
      emptyAction={{ label: '创建工作流', onClick: () => onGo('/workflows') }}
    >
      {items.map((run) => {
        const cfg = STATUS_CFG[run.status] || STATUS_CFG.success;
        return (
          <button
            key={run.id}
            className={styles.recentItem}
            onClick={() => onGo(`/workflows/${run.workflowId}`)}
          >
            <div className={styles.recentItemIconConv} style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.06))',
              color: '#f59e0b',
            }}>
              <DeploymentUnitOutlined />
            </div>
            <div className={styles.recentItemInfo}>
              <div className={styles.recentItemName}>{run.workflowName}</div>
              <div className={styles.recentItemMeta}>
                <Tag color={cfg.color} icon={cfg.icon} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>
                  {cfg.label}
                </Tag>
                <span>耗时 {fmtDuration(run.duration)}</span>
              </div>
            </div>
            <span className={styles.recentItemTime}>{fmtTime(run.startedAt)}</span>
          </button>
        );
      })}
    </SectionCard>
  );
}
