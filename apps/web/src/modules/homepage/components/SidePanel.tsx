// ④ 侧面板容器 — 系统状态 + 日志预览
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { SystemStatus } from './SystemStatus';
import { LogPreview } from './LogPreview';
import type { SystemStatusData, DashboardRunLog } from '../../../api/dashboard';
import styles from './SidePanel.module.css';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  systemStatus: SystemStatusData | null;
  logs: DashboardRunLog[];
  logsLoading: boolean;
  onNavigate: (path: string) => void;
  onViewAllLogs: () => void;
}

export function SidePanel({
  collapsed,
  onToggle,
  systemStatus,
  logs,
  logsLoading,
  onNavigate,
  onViewAllLogs,
}: Props) {
  return (
    <>
      {/* 折叠切换按钮 */}
      <button
        className={styles.toggleBtn}
        onClick={onToggle}
        aria-label={collapsed ? '展开侧面板' : '折叠侧面板'}
        title={collapsed ? '展开侧面板' : '折叠侧面板'}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </button>

      {/* 面板内容（带折叠动画） */}
      <div className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ''}`}>
        <div className={styles.inner}>
          {systemStatus && <SystemStatus data={systemStatus} />}
          <LogPreview logs={logs} loading={logsLoading} onViewAll={onViewAllLogs} />
        </div>
      </div>
    </>
  );
}
