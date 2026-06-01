import { Alert, Collapse, Spin, Tag } from 'antd';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { IToolCallRecord } from '../../../api/plugins';
import styles from './ToolCallCard.module.css';

interface IToolCallCardProps {
  record: IToolCallRecord;
}

interface IToolCallErrorBoundaryProps {
  children: ReactNode;
}

interface IToolCallErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ToolCallErrorBoundary extends Component<IToolCallErrorBoundaryProps, IToolCallErrorBoundaryState> {
  state: IToolCallErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): IToolCallErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The preview chat should keep rendering even when a single tool payload is malformed.
  }

  render() {
    if (this.state.hasError) {
      return <Alert type="error" showIcon message="工具调用展示失败" description={this.state.message} />;
    }

    return this.props.children;
  }
}

function getStatusMeta(status: IToolCallRecord['status']) {
  if (status === 'running') {
    return { color: '#faad14', label: '执行中' };
  }
  if (status === 'success') {
    return { color: '#52c41a', label: '成功' };
  }
  return { color: '#ff4d4f', label: '失败' };
}

function getSummary(value: unknown) {
  if (value === undefined || value === null) return '暂无结果';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value).slice(0, 120);
}

function ToolCallCardInner({ record }: IToolCallCardProps) {
  const meta = getStatusMeta(record.status);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{record.toolName}</div>
          <div className={styles.subtitle}>调用 ID：{record.callId}</div>
        </div>
        <Tag color={meta.color}>{meta.label}</Tag>
      </div>

      <div className={styles.body}>
        {record.status === 'running' ? (
          <div className={styles.running}>
            <Spin size="small" />
            <span>工具正在执行</span>
          </div>
        ) : record.status === 'failed' ? (
          <Alert type="error" showIcon message={record.error ?? '工具执行失败'} />
        ) : (
          <Alert type="success" showIcon message={getSummary(record.result)} />
        )}
      </div>

      <Collapse
        ghost
        items={[
          {
            key: 'detail',
            label: '查看调用详情',
            children: (
              <div className={styles.detail}>
                <div>
                  <strong>参数</strong>
                  <pre>{JSON.stringify(record.params, null, 2)}</pre>
                </div>
                <div>
                  <strong>结果</strong>
                  <pre>{JSON.stringify(record.status === 'failed' ? record.error : record.result, null, 2)}</pre>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

export function ToolCallCard(props: IToolCallCardProps) {
  return (
    <ToolCallErrorBoundary>
      <ToolCallCardInner {...props} />
    </ToolCallErrorBoundary>
  );
}
