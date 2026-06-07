// 系统状态 — 侧面板子组件
import {
  ApiOutlined,
  CheckCircleFilled,
  CloudSyncOutlined,
  RocketOutlined,
  CloudUploadOutlined,
  BookOutlined,
} from '@ant-design/icons';
import type { SystemStatusData } from '../../../api/dashboard';
import styles from './SidePanel.module.css';

interface Props {
  data: SystemStatusData;
}

export function SystemStatus({ data }: Props) {
  const { plugins, publish, knowledge } = data;

  return (
    <div className={styles.subSection}>
      <div className={styles.subTitle}>系统状态</div>

      {/* 插件 */}
      <div className={styles.statusRow}>
        <ApiOutlined style={{ color: '#ec4899', fontSize: 16 }} />
        <span className={styles.statusLabel}>插件</span>
        <span className={styles.statusValue}>
          {plugins.enabled}/{plugins.total} 已启用
        </span>
        {plugins.updateAvailable > 0 && (
          <span className={styles.statusWarn}>
            <CloudSyncOutlined /> {plugins.updateAvailable} 更新
          </span>
        )}
      </div>

      {/* 发布 */}
      <div className={styles.statusRow}>
        {publish.pending > 0 ? (
          <CloudUploadOutlined style={{ color: '#f59e0b', fontSize: 16 }} />
        ) : (
          <RocketOutlined style={{ color: '#22c55e', fontSize: 16 }} />
        )}
        <span className={styles.statusLabel}>发布</span>
        {publish.pending > 0 ? (
          <span className={styles.statusWarn}>{publish.pending} 项待发布</span>
        ) : (
          <span className={styles.statusOk}>全部已发布</span>
        )}
      </div>

      {/* 知识库 */}
      <div className={styles.statusRow}>
        <BookOutlined style={{ color: '#a855f7', fontSize: 16 }} />
        <span className={styles.statusLabel}>知识库</span>
        <span className={styles.statusOk}>
          <CheckCircleFilled style={{ fontSize: 11 }} /> {knowledge.synced}/{knowledge.total} 已同步
        </span>
      </div>
    </div>
  );
}
