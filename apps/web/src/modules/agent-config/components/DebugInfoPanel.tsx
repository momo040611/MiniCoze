import { useState } from 'react';
import { Collapse, Tooltip, message } from 'antd';
import {
  CopyOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import type { TokenUsage } from '../../../api/agent-runtime';
import type { ToolCallData } from './ToolCallCard';
import styles from './DebugPanel.module.css';

interface Props {
  runId: string;
  model: string;
  latency: number;
  usage: TokenUsage | null;
  toolCalls: ToolCallData[];
}

export function DebugInfoPanel({ runId, model, latency, usage, toolCalls }: Props) {
  const [open, setOpen] = useState(false);

  const handleCopyRunId = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(runId).then(() => {
        message.success('Run ID 已复制');
      }).catch(() => {
        fallbackCopyRunId();
      });
    } else {
      fallbackCopyRunId();
    }
  };

  const fallbackCopyRunId = () => {
    const textarea = document.createElement('textarea');
    textarea.value = runId;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      message.success('Run ID 已复制');
    } catch {
      message.error('复制失败');
    } finally {
      document.body.removeChild(textarea);
    }
  };

  return (
    <Collapse
      activeKey={open ? ['debug'] : []}
      onChange={(keys) => setOpen(keys.includes('debug'))}
      bordered={false}
      className={styles.debugCollapse}
      items={[
        {
          key: 'debug',
          label: <span className={styles.debugLabel}>调试信息 ▾</span>,
          children: (
            <div className={styles.debugContent}>
              <div className={styles.debugRow}>
                <span className={styles.debugKey}>Run ID</span>
                <span className={styles.debugValue}>
                  {runId.slice(0, 16)}...
                  <Tooltip title="复制">
                    <CopyOutlined
                      className={styles.copyIcon}
                      onClick={handleCopyRunId}
                    />
                  </Tooltip>
                </span>
              </div>
              <div className={styles.debugRow}>
                <span className={styles.debugKey}>模型</span>
                <span className={styles.debugValue}>{model}</span>
              </div>
              <div className={styles.debugRow}>
                <span className={styles.debugKey}>延迟</span>
                <span className={styles.debugValue}>
                  {latency > 0 ? `${latency.toLocaleString()} ms` : '计算中...'}
                </span>
              </div>

              <div className={styles.debugSection}>
                <span className={styles.debugSectionTitle}>Token 用量</span>
                {usage ? (
                  <div className={styles.tokenBox}>
                    <div className={styles.tokenRow}>
                      <span>输入 Token</span>
                      <span>{usage.inputTokens}</span>
                    </div>
                    <div className={styles.tokenRow}>
                      <span>输出 Token</span>
                      <span>{usage.outputTokens}</span>
                    </div>
                    <div className={styles.tokenDivider} />
                    <div className={styles.tokenRow}>
                      <strong>总计</strong>
                      <strong>{usage.totalTokens}</strong>
                    </div>
                  </div>
                ) : (
                  <span className={styles.noData}>暂无数据</span>
                )}
              </div>

              <div className={styles.debugSection}>
                <span className={styles.debugSectionTitle}>工具调用链</span>
                {toolCalls.length > 0 ? (
                  <div className={styles.toolChain}>
                    {toolCalls.map((tc, i) => (
                      <div key={tc.toolCallId} className={styles.toolChainItem}>
                        <span className={styles.toolChainIndex}>{i + 1}</span>
                        <span className={styles.toolChainName}>{tc.name}</span>
                        {tc.status === 'success' ? (
                          <CheckCircleFilled style={{ color: '#22c55e', fontSize: 13 }} />
                        ) : tc.status === 'failed' ? (
                          <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 13 }} />
                        ) : null}
                        <span className={styles.toolChainStatus}>
                          {tc.status === 'success' ? '成功' : tc.status === 'failed' ? '失败' : ''}
                        </span>
                        <span className={styles.toolChainDuration}>
                          {tc.duration !== undefined ? `${tc.duration}ms` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noData}>暂无工具调用</span>
                )}
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
