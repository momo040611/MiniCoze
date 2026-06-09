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
      <button
        className={styles.toggleBtn}
        onClick={onToggle}
        aria-label={collapsed ? '展开侧面板' : '折叠侧面板'}
        title={collapsed ? '展开侧面板' : '折叠侧面板'}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </button>

      <div className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ''}`}>
        <div className={styles.inner}>
          {systemStatus && <SystemStatus data={systemStatus} />}
          <LogPreview logs={logs} loading={logsLoading} onViewAll={onViewAllLogs} />
        </div>
      </div>
    </>
  );
}
