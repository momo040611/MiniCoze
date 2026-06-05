// 智能体发布面板 — 展示所有智能体及发布/下线操作

import { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Modal, Input, Tooltip } from 'antd';
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getAgentList,
  checkAgent,
  publishAgent,
  offlineAgent,
  type AgentItem,
  type PublishCheckItem,
} from '../api';
import styles from '../index.module.css';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: '草稿' },
  ACTIVE: { color: 'green', label: '已发布' },
  ARCHIVED: { color: 'red', label: '已归档' },
};

export function AgentPublishPanel() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [checkModalOpen, setCheckModalOpen] = useState(false);
  const [checkItems, setCheckItems] = useState<PublishCheckItem[]>([]);
  const [checkTarget, setCheckTarget] = useState<AgentItem | null>(null);
  const [changelog, setChangelog] = useState('');

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const list = await getAgentList();
      setAgents(list);
    } catch {
      message.error('获取智能体列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handlePreCheck = async (agent: AgentItem) => {
    try {
      const result = await checkAgent(agent.id);
      setCheckItems(result.items);
      setCheckTarget(agent);
      setChangelog('');
      setCheckModalOpen(true);
    } catch {
      message.error('发布检查失败');
    }
  };

  const handleConfirmPublish = async () => {
    if (!checkTarget) return;
    setPublishingId(checkTarget.id);
    try {
      await publishAgent(checkTarget.id, changelog || undefined);
      message.success(`「${checkTarget.name}」发布成功`);
      setCheckModalOpen(false);
      fetchAgents();
    } catch {
      message.error('发布失败');
    } finally {
      setPublishingId(null);
    }
  };

  const handleOffline = (agent: AgentItem) => {
    Modal.confirm({
      title: `确认取消发布「${agent.name}」？`,
      content: '取消发布后所有发布渠道将被禁用，用户将无法访问该智能体。状态将恢复为草稿。',
      okText: '确认取消发布',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await offlineAgent(agent.id);
          message.success(`「${agent.name}」已取消发布`);
          fetchAgents();
        } catch {
          message.error('取消失败');
        }
      },
    });
  };

  const columns: ColumnsType<AgentItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          <span>{name}</span>
          {record.description && (
            <Tooltip title={record.description}>
              <span className={styles.panelDesc}>
                {record.description}
              </span>
            </Tooltip>
          )}
        </Space>
      ),
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
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.status === 'DRAFT' && (
            <Button
              size="small"
              className={styles.btnPrimary}
              icon={<CloudUploadOutlined />}
              onClick={() => handlePreCheck(record)}
            >
              发布
            </Button>
          )}
          {record.status === 'ACTIVE' && (
            <Button
              size="small"
              className={styles.btnOutline}
              icon={<CloudDownloadOutlined />}
              onClick={() => handleOffline(record)}
            >
              取消发布
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={agents}
        loading={loading}
        pagination={false}
        locale={{ emptyText: '暂无智能体' }}
      />

      <Modal
        title={`发布检查 — ${checkTarget?.name ?? ''}`}
        open={checkModalOpen}
        onCancel={() => setCheckModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCheckModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="publish"
            type="primary"
            loading={!!publishingId}
            disabled={checkItems.length === 0 || checkItems.some((i) => !i.passed)}
            onClick={handleConfirmPublish}
          >
            确认发布
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          {checkItems.map((item) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
              }}
            >
              {item.passed ? (
                <CheckCircleOutlined style={{ color: '#16a34a' }} />
              ) : (
                <ExclamationCircleOutlined style={{ color: '#dc2626' }} />
              )}
              <span>{item.label}</span>
              {item.message && (
                <span style={{ color: '#8896a6', fontSize: 12 }}>{item.message}</span>
              )}
            </div>
          ))}
        </div>
        <Input.TextArea
          placeholder="发布说明（可选）"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          rows={2}
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  );
}
