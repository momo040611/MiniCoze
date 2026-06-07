// 日志预览 — 侧面板子组件（精简视图，点击展开 Drawer）
import { Skeleton } from 'antd';
import {
  ToolOutlined,
  BookOutlined,
  DeploymentUnitOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  RightOutlined,
} from '@ant-design/icons';
import type { DashboardRunLog } from '../../../api/dashboard';
import styles from './SidePanel.module.css';

const TYPE_CFG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  tool_call: { label: '工具调用', icon: <ToolOutlined />, color: '#3b82f6' },
  knowledge_retrieval: { label: '知识库召回', icon: <BookOutlined />, color: '#a855f7' },
  workflow_step: { label: '工作流步骤', icon: <DeploymentUnitOutlined />, color: '#f59e0b' },
};

function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  logs: DashboardRunLog[];
  loading: boolean;
  onViewAll: () => void;
}

export function LogPreview({ logs, loading, onViewAll }: Props) {
  return (
    <div className={styles.subSection}>
      <div className={styles.subTitle}>运行日志</div>

      {loading ? (
        <div style={{ padding: '8px 0' }}>
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        </div>
      ) : logs.length === 0 ? (
        <p className={styles.emptyHint}>暂无运行日志</p>
      ) : (
        <div className={styles.logList}>
          {logs.slice(0, 5).map((log) => {
            const cfg = TYPE_CFG[log.type] ?? TYPE_CFG.tool_call;
            return (
              <div key={log.id} className={styles.logItem}>
                <span style={{ color: cfg.color, fontSize: 14, flexShrink: 0 }}>{cfg.icon}</span>
                <div className={styles.logContent}>
                  <span className={styles.logAgent}>{log.agentName}</span>
                  <span className={styles.logText}>{log.content}</span>
                </div>
                <span className={styles.logTime}>{fmtTime(log.timestamp)}</span>
                {log.status && (
                  <span style={{ color: log.status === 'success' ? '#22c55e' : '#ef4444', fontSize: 11 }}>
                    {log.status === 'success' ? <CheckCircleFilled /> : <CloseCircleFilled />}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button className={styles.viewAllBtn} onClick={onViewAll}>
        查看全部日志 <RightOutlined />
      </button>
    </div>
  );
}
