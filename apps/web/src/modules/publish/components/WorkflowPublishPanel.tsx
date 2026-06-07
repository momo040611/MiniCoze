// 工作流发布面板 — 展示所有工作流及发布操作

import { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Tooltip } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getWorkflowList, publishWorkflow, type WorkflowItem } from '../api';
import styles from '../index.module.css';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: '草稿' },
  ACTIVE: { color: 'green', label: '已发布' },
  ARCHIVED: { color: 'red', label: '已归档' },
};

export function WorkflowPublishPanel() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const list = await getWorkflowList();
      setWorkflows(list);
    } catch {
      message.error('获取工作流列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handlePublish = async (workflow: WorkflowItem) => {
    setPublishingId(workflow.id);
    try {
      await publishWorkflow(workflow.id);
      message.success(`「${workflow.name}」发布成功`);
      fetchWorkflows();
    } catch {
      message.error('发布失败，请检查工作流草稿是否合法');
    } finally {
      setPublishingId(null);
    }
  };

  const columns: ColumnsType<WorkflowItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (val: string | null) => {
        if (!val) return <span className={styles.panelDesc}>-</span>;
        return val;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = STATUS_MAP[status] ?? { color: 'default', label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          {record.status !== 'ACTIVE' && (
            <Button
              size="small"
              className={styles.btnPrimary}
              icon={<CloudUploadOutlined />}
              loading={publishingId === record.id}
              onClick={() => handlePublish(record)}
            >
              发布
            </Button>
          )}
          {record.status === 'ACTIVE' && (
            <Tooltip title="工作流暂不支持取消发布，请前往工作流编辑页处理">
              <Button size="small" className={styles.btnOutline} disabled>
                取消发布
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={workflows}
      loading={loading}
      pagination={false}
      locale={{ emptyText: '暂无工作流' }}
    />
  );
}
