// 设置页 — 密钥管理（真实 API）+ 工作区设置 / 成员权限入口
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  KeyOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  createCredential,
  deleteCredential,
  listCredentials,
  type CredentialType,
  type WorkspaceCredential,
} from '../../api/settings';
import styles from './index.module.css';

const CREDENTIAL_TYPE_OPTIONS: Array<{ value: CredentialType; label: string }> = [
  { value: 'BEARER_TOKEN', label: 'Bearer Token（Authorization 请求头）' },
  { value: 'API_KEY_HEADER', label: 'API Key（自定义 Header）' },
  { value: 'BASIC_AUTH', label: 'Basic Auth（用户名/密码）' },
];

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  BEARER_TOKEN: 'Bearer Token',
  API_KEY_HEADER: 'API Key',
  BASIC_AUTH: 'Basic Auth',
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function SettingsPage() {
  const nav = useNavigate();

  // 密钥列表状态
  const [credentials, setCredentials] = useState<WorkspaceCredential[]>([]);
  const [loading, setLoading] = useState(true);

  // 新建密钥状态
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<CredentialType>('BEARER_TOKEN');
  const [secret, setSecret] = useState('');
  const [creating, setCreating] = useState(false);

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    try {
      setCredentials(await listCredentials());
    } catch (err) {
      console.error(err);
      message.error('加载密钥列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !secret.trim()) return;
    setCreating(true);
    try {
      await createCredential({ name: name.trim(), type, secret: secret.trim() });
      message.success('密钥已创建');
      setCreateOpen(false);
      setName('');
      setType('BEARER_TOKEN');
      setSecret('');
      await loadCredentials();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建失败';
      message.error(msg);
    } finally {
      setCreating(false);
    }
  }, [name, type, secret, loadCredentials]);

  const handleDelete = useCallback(
    async (credentialId: string) => {
      try {
        await deleteCredential(credentialId);
        message.success('密钥已删除');
        await loadCredentials();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '删除失败';
        message.error(msg);
      }
    },
    [loadCredentials],
  );

  const columns: ColumnsType<WorkspaceCredential> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => (
        <Space>
          <KeyOutlined style={{ color: '#1d4ed8' }} />
          <span style={{ fontWeight: 500 }}>{value}</span>
          {record.status === 'DISABLED' && (
            <Tag color="default">已停用</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (value: CredentialType) => CREDENTIAL_TYPE_LABELS[value] ?? value,
    },
    {
      title: '密钥掩码',
      dataIndex: 'maskedHint',
      key: 'maskedHint',
      render: (value: string) => (
        <code style={{ fontSize: 12, color: '#64748b' }}>{value}</code>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确认删除"
          description="删除后使用该密钥的模型服务将无法认证，确定删除吗？"
          onConfirm={() => void handleDelete(record.id)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Settings</span>
        <h1>设置</h1>
        <p>集中管理工作区密钥、权限和平台级配置。</p>
      </div>

      <div className={styles.grid}>
        <article className={styles.panel} key="secrets">
          <div className={styles.icon}>
            <KeyOutlined />
          </div>
          <h2>密钥管理</h2>
          <p>为模型 Provider 与第三方服务创建工作区级密钥，密钥仅写入、不回显。</p>
          <div className={styles.panelActions}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              新建密钥
            </Button>
          </div>
        </article>
        <article
          className={`${styles.panel} ${styles.linkPanel}`}
          key="workspace"
          onClick={() => nav('/workspace/settings')}
        >
          <div className={styles.icon}>
            <SettingOutlined />
          </div>
          <h2>工作区设置</h2>
          <p>修改工作区名称与描述、删除工作区。</p>
          <span className={styles.linkHint}>前往工作区设置 →</span>
        </article>
        <article
          className={`${styles.panel} ${styles.linkPanel}`}
          key="members"
          onClick={() => nav('/workspace/settings')}
        >
          <div className={styles.icon}>
            <TeamOutlined />
          </div>
          <h2>成员与权限</h2>
          <p>邀请成员、分配角色、移除成员。</p>
          <span className={styles.linkHint}>前往成员管理 →</span>
        </article>
      </div>

      <div className={styles.tablePanel}>
        <h2 className={styles.tableTitle}>工作区密钥</h2>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin />
          </div>
        ) : credentials.length === 0 ? (
          <Empty
            description={'暂无密钥，点击上方「新建密钥」添加'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table<WorkspaceCredential>
            rowKey="id"
            columns={columns}
            dataSource={credentials}
            pagination={false}
            size="middle"
          />
        )}
      </div>

      <Modal
        title="新建密钥"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setName('');
          setType('BEARER_TOKEN');
          setSecret('');
        }}
        footer={null}
        destroyOnClose
      >
        <div className={styles.createForm}>
          <div className={styles.formItem}>
            <label className={styles.formLabel}>名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：OpenAI API Key"
              maxLength={100}
            />
          </div>
          <div className={styles.formItem}>
            <label className={styles.formLabel}>类型</label>
            <Select
              value={type}
              options={CREDENTIAL_TYPE_OPTIONS}
              onChange={(value) => setType(value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className={styles.formItem}>
            <label className={styles.formLabel}>密钥内容</label>
            <Input.Password
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="粘贴密钥（仅写入，保存后不回显）"
              maxLength={4096}
            />
          </div>
          <div className={styles.formActions}>
            <Button
              onClick={() => {
                setCreateOpen(false);
                setName('');
                setType('BEARER_TOKEN');
                setSecret('');
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleCreate}
              loading={creating}
              disabled={!name.trim() || !secret.trim()}
            >
              创建
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
