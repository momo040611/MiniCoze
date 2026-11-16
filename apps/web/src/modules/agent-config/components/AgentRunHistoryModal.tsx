import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Modal,
  Table,
  Tag,
  type TableColumnsType,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import {
  listAgentRuns,
  type AgentRunItem,
  type AgentRunStatus,
} from '../../../api/agent-runtime';
import styles from './AgentRunHistoryModal.module.css';

const STATUS_META: Record<AgentRunStatus, { color: string; label: string }> = {
  CREATED: { color: 'default', label: '已创建' },
  IN_PROGRESS: { color: 'processing', label: '运行中' },
  COMPLETED: { color: 'success', label: '成功' },
  FAILED: { color: 'error', label: '失败' },
  CANCELED: { color: 'default', label: '已取消' },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface Props {
  open: boolean;
  agentId: string;
  onClose: () => void;
}

/**
 * Agent 运行历史：读取 AgentRun 持久化记录，支持按状态筛选与运行中取消。
 */
export function AgentRunHistoryModal({ open, agentId, onClose }: Props) {
  const [runs, setRuns] = useState<AgentRunItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<AgentRunStatus | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAgentRuns({
        agentId,
        page,
        pageSize,
        status: statusFilter || undefined,
      });
      setRuns(result.list);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载运行记录失败');
    } finally {
      setLoading(false);
    }
  }, [agentId, page, pageSize, statusFilter]);

  useEffect(() => {
    if (open) {
      void fetchRuns();
    }
  }, [open, fetchRuns]);

  useEffect(() => {
    if (!open) {
      setPage(1);
      setStatusFilter('');
    }
  }, [open]);

  const columns: TableColumnsType<AgentRunItem> = [
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: AgentRunStatus) => {
        const meta = STATUS_META[status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 80,
      render: (source: AgentRunItem['source'], record) => (
        <span>
          {source === 'CHAT' ? '调试' : source === 'PUBLIC' ? '分享页' : 'API'}
          {record.isPreview ? (
            <Tag style={{ marginLeft: 4 }}>预览</Tag>
          ) : null}
        </span>
      ),
    },
    {
      title: '模型',
      dataIndex: 'model',
      width: 140,
      ellipsis: true,
      render: (model: string | null) => model ?? '-',
    },
    {
      title: 'Token',
      width: 90,
      render: (_, record) =>
        record.totalTokens !== null ? record.totalTokens.toLocaleString() : '-',
    },
    {
      title: '工具',
      dataIndex: 'toolCallCount',
      width: 60,
      render: (count: number) => (count > 0 ? `${count} 次` : '-'),
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      width: 80,
      render: (ms: number | null) => formatDuration(ms),
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      width: 150,
      render: (value: string) => new Date(value).toLocaleString(),
    },
  ];

  return (
    <Modal
      title="运行历史"
      open={open}
      onCancel={onClose}
      footer={null}
      width={860}
      destroyOnHidden
    >
      <div className={styles.toolbar}>
        <select
          className={styles.statusSelect}
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as AgentRunStatus | '');
            setPage(1);
          }}
        >
          <option value="">全部状态</option>
          {Object.entries(STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => void fetchRuns()}
        >
          刷新
        </Button>
        <span className={styles.totalText}>共 {total} 条</span>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <Table<AgentRunItem>
        rowKey="runId"
        size="small"
        columns={columns}
        dataSource={runs}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
        expandable={{
          expandedRowRender: (record) =>
            record.error ? (
              <div className={styles.errorDetail}>错误：{record.error}</div>
            ) : (
              <div className={styles.detailRow}>
                <span>Run ID：{record.runId}</span>
                <span>
                  输入 {record.promptTokens ?? '-'} / 输出{' '}
                  {record.completionTokens ?? '-'} tokens
                </span>
                <span>
                  结束：
                  {record.finishedAt
                    ? new Date(record.finishedAt).toLocaleString()
                    : '-'}
                </span>
              </div>
            ),
          rowExpandable: (record) =>
            Boolean(record.error) || record.status === 'COMPLETED',
        }}
      />
    </Modal>
  );
}
