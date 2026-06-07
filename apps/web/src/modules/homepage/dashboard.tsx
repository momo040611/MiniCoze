import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Result, Skeleton } from 'antd';
import { ThunderboltOutlined, ToolOutlined, BookOutlined, DeploymentUnitOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { useDashboard } from './hooks/useDashboard';
import { WorkspaceCard } from './components/WorkspaceCard';
import { StatsOverview } from './components/StatsOverview';
import { ActivityTimeline } from './components/ActivityTimeline';
import { SidePanel } from './components/SidePanel';
import type { DashboardRunLog } from '../../api/dashboard';
import styles from './dashboard.module.css';

const LOG_TYPE_CFG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  tool_call: { label: '工具调用', icon: <ToolOutlined />, color: '#3b82f6' },
  knowledge_retrieval: { label: '知识库召回', icon: <BookOutlined />, color: '#a855f7' },
  workflow_step: { label: '工作流步骤', icon: <DeploymentUnitOutlined />, color: '#f59e0b' },
};

function fmtLogTime(d: string): string {
  return new Date(d).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function FullLogContent({ logs }: { logs: DashboardRunLog[] }) {
  if (logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
        暂无运行日志
      </div>
    );
  }

  return (
    <div>
      {logs.map((log) => {
        const cfg = LOG_TYPE_CFG[log.type] ?? LOG_TYPE_CFG.tool_call;
        return (
          <div
            key={log.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 0',
              borderBottom: '1px solid rgba(104,119,144,0.06)',
            }}
          >
            <span style={{ fontSize: 14, color: cfg.color, marginTop: 2, flexShrink: 0 }}>{cfg.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  padding: '1px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  background: `${cfg.color}18`, color: cfg.color,
                }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{log.agentName}</span>
                {log.status && (
                  <span style={{ fontSize: 12, color: log.status === 'success' ? '#22c55e' : '#ef4444' }}>
                    {log.status === 'success' ? <CheckCircleFilled /> : <CloseCircleFilled />}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#506070', marginTop: 3, lineHeight: 1.5, wordBreak: 'break-word' }}>
                {log.content}
              </div>
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {fmtLogTime(log.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.skeletonBanner} />
      <div className={styles.skeletonStats}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonMain} />
        <div className={styles.skeletonSide} />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.errorState}>
      <Result
        status="error"
        title="数据加载失败"
        subTitle="获取工作台数据失败，请检查网络连接"
        extra={
          <button className={styles.retryBtn} onClick={onRetry}>
            <ThunderboltOutlined /> 重新加载
          </button>
        }
      />
    </div>
  );
}

export function DashboardPage() {
  const nav = useNavigate();
  const dashboard = useDashboard();
  const {
    data,
    statsState,
    activityState,
    systemState,
    logsState,
    refresh,
    loadMoreActivities,
    sidePanelCollapsed,
    toggleSidePanel,
    logDrawerOpen,
    openLogDrawer,
    closeLogDrawer,
    stats,
    activities,
    hasMoreActivities,
    systemStatus,
    userName,
    workspaceName,
    workspaceDescription,
    workspaceRole,
    memberCount,
    greeting,
    dateStr,
  } = dashboard;

  const [switcherOpen, setSwitcherOpen] = useState(false);

  const go = useCallback((path: string) => nav(path), [nav]);
  const handleSwitchWorkspace = useCallback(() => {
    setSwitcherOpen(true);
  }, []);

  if (statsState === 'loading' && !data) {
    return <LoadingSkeleton />;
  }

  if (statsState === 'error' && !data) {
    return <ErrorState onRetry={refresh} />;
  }

  return (
    <div className={styles.page}>
      <WorkspaceCard
        greeting={greeting}
        userName={userName}
        dateStr={dateStr}
        workspaceName={workspaceName}
        workspaceDescription={workspaceDescription}
        memberCount={memberCount}
        role={workspaceRole}
        onSwitchWorkspace={handleSwitchWorkspace}
      />

      <StatsOverview
        stats={stats}
        loading={statsState === 'loading'}
        onClick={go}
      />

      <div className={styles.mainRow}>
        <div className={`${styles.timelineWrap} ${sidePanelCollapsed ? styles.timelineFull : ''}`}>
          <ActivityTimeline
            items={activities}
            loading={activityState === 'loading'}
            error={activityState === 'error' ? '获取活动数据失败' : null}
            hasMore={hasMoreActivities}
            onRetry={refresh}
            onLoadMore={loadMoreActivities}
            onNavigate={go}
          />
        </div>

        <div className={styles.sidePanelWrap}>
          <SidePanel
            collapsed={sidePanelCollapsed}
            onToggle={toggleSidePanel}
            systemStatus={systemStatus}
            logs={data?.recentLogs ?? []}
            logsLoading={logsState === 'loading'}
            onNavigate={go}
            onViewAllLogs={openLogDrawer}
          />
        </div>
      </div>

      <Drawer
        title="AgentRun 统一运行日志"
        placement="right"
        width={520}
        open={logDrawerOpen}
        onClose={closeLogDrawer}
        destroyOnClose
      >
        <FullLogContent logs={data?.recentLogs ?? []} />
      </Drawer>
    </div>
  );
}
