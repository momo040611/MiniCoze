
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamOutlined, SettingOutlined, SwapOutlined, CrownOutlined } from '@ant-design/icons';
import styles from './WorkspaceCard.module.css';

interface Props {
  greeting: string;
  userName: string;
  dateStr: string;
  workspaceName: string;
  workspaceDescription?: string | null;
  memberCount: number;
  role?: string;
  onSwitchWorkspace?: () => void;
  extraActions?: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: '所有者',
  ADMIN: '管理员',
  MEMBER: '成员',
};

export function WorkspaceCard({
  greeting,
  userName,
  dateStr,
  workspaceName,
  workspaceDescription,
  memberCount,
  role,
  onSwitchWorkspace,
  extraActions,
}: Props) {
  const nav = useNavigate();

  const handleSettings = useCallback(() => {
    nav('/workspace/settings');
  }, [nav]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.info}>
          <h1 className={styles.greeting}>
            {greeting}，{userName}
          </h1>
          <p className={styles.date}>{dateStr}</p>
        </div>
        <div className={styles.actions}>
          {extraActions ?? (
            <button
              className={styles.actionBtn}
              onClick={onSwitchWorkspace}
              title="切换工作区"
            >
              <SwapOutlined />
              <span>切换</span>
            </button>
          )}
          <button
            className={styles.actionBtn}
            onClick={handleSettings}
            title="工作区设置"
          >
            <SettingOutlined />
            <span>设置</span>
          </button>
        </div>
      </div>

      <div className={styles.meta}>
        <div className={styles.workspaceInfo}>
          <span className={styles.workspaceName}>
            🏢 {workspaceName}
          </span>
          {workspaceDescription && (
            <span className={styles.workspaceDesc}>
              {workspaceDescription}
            </span>
          )}
        </div>
        <div className={styles.stats}>
          <span className={styles.statItem}>
            <TeamOutlined />
            <span>{memberCount} 位成员</span>
          </span>
          {role && (
            <span className={styles.statItem}>
              <CrownOutlined />
              <span>{ROLE_LABELS[role] ?? role}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
