import { useState } from 'react';
import { ToolOutlined, CheckCircleFilled, CloseCircleFilled, LoadingOutlined } from '@ant-design/icons';
import styles from './DebugPanel.module.css';

export type ToolCallStatus = 'executing' | 'success' | 'failed';

export interface ToolCallData {
  toolCallId: string;
  name: string;
  args: unknown;
  result?: unknown;
  error?: string;
  status: ToolCallStatus;
  duration?: number;
}

interface Props {
  data: ToolCallData;
}

const MAX_ARG_LENGTH = 500;

/** 安全的 JSON.stringify，处理循环引用、null 和 undefined */
function safeStringify(obj: unknown): string {
  if (obj === undefined || obj === null) {
    return '{}';
  }
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[循环引用]';
        seen.add(value);
      }
      return value;
    }, 2);
  } catch {
    return String(obj);
  }
}

function truncateJson(obj: unknown): string {
  const str = safeStringify(obj);
  return str.length > MAX_ARG_LENGTH ? str.slice(0, MAX_ARG_LENGTH) + '\n// ... (截断，展开全部)' : str;
}

function JsonBlock({ data, label }: { data: unknown; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const full = safeStringify(data);
  const truncated = truncateJson(data);
  const needsExpand = full.length > MAX_ARG_LENGTH;

  return (
    <div className={styles.toolSection}>
      <div className={styles.toolSectionLabel}>{label}</div>
      <pre className={styles.toolJson}>
        {needsExpand && !expanded ? truncated : full}
      </pre>
      {needsExpand && (
        <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起' : '展开全部'}
        </button>
      )}
    </div>
  );
}

export function ToolCallCard({ data }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const statusIcon = {
    executing: <LoadingOutlined style={{ color: '#1677ff' }} />,
    success: <CheckCircleFilled style={{ color: '#22c55e' }} />,
    failed: <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
  }[data.status];

  const statusText = {
    executing: '执行中...',
    success: `调用成功${data.duration !== undefined ? ` · 耗时 ${data.duration}ms` : ''}`,
    failed: `调用失败${data.duration !== undefined ? ` · 耗时 ${data.duration}ms` : ''}`,
  }[data.status];

  const statusClass = {
    executing: styles.toolExecuting,
    success: styles.toolSuccess,
    failed: styles.toolFailed,
  }[data.status];

  return (
    <div className={`${styles.toolCard} ${statusClass}`}>
      <div className={styles.toolHeader} onClick={() => setCollapsed(!collapsed)}>
        <div className={styles.toolHeaderLeft}>
          <ToolOutlined className={styles.toolIcon} />
          <span className={styles.toolName}>{data.name}</span>
        </div>
        <div className={styles.toolHeaderRight}>
          <span className={styles.toolStatus}>
            {statusIcon} {statusText}
          </span>
          <button className={styles.collapseBtn} type="button">
            {collapsed ? '展开 ▼' : '收起 ▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={styles.toolBody}>
          <JsonBlock data={data.args} label="调用参数" />
          {data.status === 'success' && data.result !== undefined && (
            <JsonBlock data={data.result} label="返回结果" />
          )}
          {data.status === 'failed' && data.error && (
            <div className={styles.toolSection}>
              <div className={styles.toolSectionLabel}>错误信息</div>
              <pre className={styles.toolError}>{data.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
