// ② 统计概览 — 数据展示 + 快捷操作
import { useCallback } from 'react';
import { Skeleton } from 'antd';
import { StatCard } from './shared/StatCard';
import type { StatItem } from '../../../api/dashboard';
import styles from './StatsOverview.module.css';

interface Props {
  stats: StatItem[];
  loading: boolean;
  onClick: (path: string) => void;
  onCreate?: (key: string) => void;
}

export function StatsOverview({ stats, loading, onClick, onCreate }: Props) {
  const handleCreate = useCallback(
    (key: string) => {
      // 根据 key 跳转到对应的创建页面
      const createPaths: Record<string, string> = {
        agents: '/agents',
        knowledge: '/knowledge',
        workflows: '/workflows',
        plugins: '/plugins',
        publish: '/publish',
      };
      onClick(createPaths[key] ?? '/');
    },
    [onClick],
  );

  if (loading) {
    return (
      <div className={styles.grid}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeleton}>
            <div className={styles.skeletonHeader}>
              <Skeleton.Avatar active size={40} shape="square" style={{ borderRadius: 10 }} />
            </div>
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {stats.map((s) => (
        <StatCard
          key={s.key}
          icon={s.icon}
          label={s.label}
          value={s.value}
          accentColor={s.accentColor}
          targetPath={s.targetPath}
          onClick={onClick}
          onCreate={() => handleCreate(s.key)}
        />
      ))}
    </div>
  );
}
