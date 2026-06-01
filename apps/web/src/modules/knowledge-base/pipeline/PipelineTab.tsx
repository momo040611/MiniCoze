import { PlayCircleOutlined, ReloadOutlined, RetweetOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Progress, Space, Table, Tag, Timeline, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  knowledgePipelineApi,
  type PipelineLog,
  type PipelineRun,
  type PipelineRunStep,
  type StepStatus,
} from '../../../api/knowledge-pipeline';
import styles from './PipelineTab.module.css';

type PipelineTabProps = {
  knowledgeBaseId: string;
};

const statusText: Record<StepStatus, string> = {
  pending: '等待中',
  running: '处理中',
  success: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

const statusColor: Record<StepStatus, string> = {
  pending: 'gold',
  running: 'blue',
  success: 'green',
  failed: 'red',
  skipped: 'default',
};

function formatTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getDuration(step: PipelineRunStep) {
  if (step.durationMs) return `${(step.durationMs / 1000).toFixed(1)}s`;
  if (step.startedAt && step.endedAt) {
    const duration = new Date(step.endedAt).getTime() - new Date(step.startedAt).getTime();
    return `${Math.max(duration / 1000, 0).toFixed(1)}s`;
  }
  return '-';
}

function PipelineTab({ knowledgeBaseId }: PipelineTabProps) {
  const navigate = useNavigate();
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRun = useCallback(async () => {
    setLoading(true);
    try {
      const response = await knowledgePipelineApi.getLatestRun(knowledgeBaseId);
      setRun(response.data);
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await knowledgePipelineApi.refreshLatestRun(knowledgeBaseId);
      setRun(response.data);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    setLoading(true);
    try {
      const response = await knowledgePipelineApi.runPipeline(knowledgeBaseId);
      setRun(response.data);
      message.success('已启动一次流水线测试运行');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (step: PipelineRunStep) => {
    if (!run) return;
    const response = await knowledgePipelineApi.retryRunStep(run.id, step.stepId);
    setRun(response.data);
    message.success('已提交重试');
  };

  const columns: ColumnsType<PipelineRunStep> = [
    {
      title: '步骤',
      dataIndex: 'name',
      width: 180,
      render: (name: string, record) => (
        <Space direction="vertical" size={2}>
          <strong>{name}</strong>
          <Typography.Text type="secondary">{record.type}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: StepStatus) => <Tag color={statusColor[status]}>{statusText[status]}</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      render: formatTime,
    },
    {
      title: '结束时间',
      dataIndex: 'endedAt',
      render: formatTime,
    },
    {
      title: '耗时',
      render: (_, record) => getDuration(record),
    },
    {
      title: '失败原因',
      dataIndex: 'failureReason',
      render: (value?: string) => value || '-',
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) =>
        record.status === 'failed' ? (
          <Button size="small" icon={<RetweetOutlined />} onClick={() => handleRetry(record)}>
            重试
          </Button>
        ) : null,
    },
  ];

  const logs = run?.logs ?? [];

  if (!run) {
    return (
      <Card className={styles.emptyCard}>
        <Empty description="当前知识库还没有流水线执行记录">
          <Space>
            <Button icon={<SettingOutlined />} onClick={() => navigate('/knowledge/pipeline')}>
              配置生产流水线
            </Button>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={handleRun}>
              运行测试
            </Button>
          </Space>
        </Empty>
      </Card>
    );
  }

  return (
    <div className={styles.page}>
      <Card className={styles.summary}>
        <div className={styles.summaryHeader}>
          <div>
            <Typography.Text type="secondary">当前流水线</Typography.Text>
            <h3>{run.pipelineName}</h3>
            <Typography.Text type="secondary">
              版本 v{run.pipelineVersion} · 最近更新 {formatTime(run.updatedAt)}
            </Typography.Text>
          </div>
          <Space wrap>
            <Button icon={<SettingOutlined />} onClick={() => navigate('/knowledge/pipeline')}>
              配置生产流水线
            </Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={handleRefresh}>
              刷新状态
            </Button>
            <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={handleRun}>
              运行测试
            </Button>
          </Space>
        </div>
        <Progress
          percent={run.progress}
          status={run.status === 'failed' ? 'exception' : run.progress >= 100 ? 'success' : 'active'}
        />
        <div className={styles.statusLine}>
          <Tag color={statusColor[run.status]}>{statusText[run.status]}</Tag>
          <span>开始时间：{formatTime(run.startedAt)}</span>
        </div>
      </Card>

      <Card title="步骤执行状态" className={styles.card}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={run.steps}
          pagination={false}
          size="middle"
        />
      </Card>

      <Card title="处理日志" className={styles.card}>
        {logs.length === 0 ? (
          <Empty description="暂无处理日志" />
        ) : (
          <Timeline
            items={logs.map((log: PipelineLog) => ({
              color: log.level === 'error' ? 'red' : log.level === 'warn' ? 'gold' : 'blue',
              children: `${formatTime(log.createdAt)} · ${log.message}`,
            }))}
          />
        )}
      </Card>
    </div>
  );
}

export { PipelineTab };
