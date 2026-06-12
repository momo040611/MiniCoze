import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
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

class ToolCallErrorBoundary extends Component<
  IToolCallErrorBoundaryProps,
  IToolCallErrorBoundaryState
> {
  state: IToolCallErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(
    error: Error,
  ): IToolCallErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Keep the test drawer usable when one malformed payload cannot render.
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          type="error"
          showIcon
          message="工具调用展示失败"
          description={this.state.message}
        />
      );
    }
    return this.props.children;
  }
}

function getStatusMeta(status: IToolCallRecord['status']) {
  if (status === 'running') {
    return {
      color: 'processing',
      label: '执行中',
      icon: <LoadingOutlined />,
    } as const;
  }
  if (status === 'success') {
    return {
      color: 'success',
      label: '成功',
      icon: <CheckCircleOutlined />,
    } as const;
  }
  return {
    color: 'error',
    label: '失败',
    icon: <CloseCircleOutlined />,
  } as const;
}

function formatPayload(value: unknown) {
  if (value === undefined || value === null) return '暂无数据';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getDuration(record: IToolCallRecord) {
  if (!record.finishedAt) return null;
  const startedAt = new Date(record.startedAt).getTime();
  const finishedAt = new Date(record.finishedAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return null;
  return Math.max(0, finishedAt - startedAt);
}

function ToolCallCardInner({ record }: IToolCallCardProps) {
  const meta = getStatusMeta(record.status);
  const duration = getDuration(record);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{record.toolName}</div>
          <div className={styles.subtitle}>
            <span>调用 ID：{record.callId}</span>
            <span>{new Date(record.startedAt).toLocaleTimeString()}</span>
            {duration !== null && <span>{duration} ms</span>}
          </div>
        </div>
        <Tag color={meta.color} icon={meta.icon}>
          {meta.label}
        </Tag>
      </div>

      <div className={styles.body}>
        {record.status === 'running' ? (
          <div className={styles.running}>
            <Spin size="small" />
            <span>正在向插件工具发送请求并等待结果...</span>
          </div>
        ) : record.status === 'failed' ? (
          <Alert
            type="error"
            showIcon
            message="工具执行失败"
            description={record.error ?? '未返回错误详情'}
          />
        ) : (
          <Alert type="success" showIcon message="工具执行完成" />
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
                  <strong>输入参数</strong>
                  <pre>{formatPayload(record.params)}</pre>
                </div>
                <div>
                  <strong>
                    {record.status === 'failed' ? '错误信息' : '输出结果'}
                  </strong>
                  <pre>
                    {formatPayload(
                      record.status === 'failed'
                        ? record.error
                        : record.result,
                    )}
                  </pre>
                </div>
              </div>
            ),
          },
        ]}
      />
    </article>
  );
}

export function ToolCallCard(props: IToolCallCardProps) {
  return (
    <ToolCallErrorBoundary>
      <ToolCallCardInner {...props} />
    </ToolCallErrorBoundary>
  );
}
