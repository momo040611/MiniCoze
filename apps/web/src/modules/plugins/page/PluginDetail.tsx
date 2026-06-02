import { App, Badge, Breadcrumb, Button, Descriptions, Drawer, Empty, Popconfirm, Skeleton, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, ApiOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import type { IPluginTool, PluginStatus, PluginToolStatus, PluginType } from '../../../api/plugins';
import { ToolTestPanel } from '../components/ToolTestPanel';
import { usePluginDetail } from '../hooks/usePluginDetail';
import styles from './PluginDetail.module.css';

const typeText: Record<PluginType, string> = {
  BUILTIN: '内置插件',
  HTTP: 'HTTP 插件',
};

const statusText: Record<PluginStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '已启用',
  DISABLED: '已停用',
  ARCHIVED: '已归档',
};

const statusColor: Record<PluginStatus, string> = {
  DRAFT: 'gold',
  ACTIVE: 'green',
  DISABLED: 'default',
  ARCHIVED: 'red',
};

const toolStatusText: Record<PluginToolStatus, string> = {
  ACTIVE: '可用',
  DISABLED: '不可用',
};

export function PluginDetail() {
  const navigate = useNavigate();
  const { pluginId } = useParams<{ pluginId: string }>();
  const { message } = App.useApp();
  const { data, loading, error, refresh, toggle } = usePluginDetail(pluginId);
  const [testingTool, setTestingTool] = useState<IPluginTool | null>(null);

  const handleToggle = async () => {
    if (!data) return;

    const nextEnabled = !data.enabled;
    try {
      await toggle(nextEnabled);
      message.success(nextEnabled ? '插件已启用' : '插件已停用');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '插件状态更新失败');
    }
  };

  const columns: ColumnsType<IPluginTool> = [
    {
      title: '工具',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, tool) => (
        <div className={styles.toolName}>
          <strong>{name}</strong>
          <span>{tool.code}</span>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => <span className={styles.toolDesc}>{description}</span>,
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_value: unknown, tool) =>
        data?.enabled && tool.enabled ? (
          <Badge status="success" text={toolStatusText[tool.status]} />
        ) : (
          <Badge status="default" text="不可用" />
        ),
    },
    {
      title: '参数 Schema',
      dataIndex: 'inputSchema',
      key: 'inputSchema',
      render: (_value: unknown, tool) => (
        <pre className={styles.schema}>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_value: unknown, tool) => (
        <Button type="link" disabled={!data?.enabled || !tool.enabled} onClick={() => setTestingTool(tool)}>
          测试
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <section className={styles.page}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </section>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.center}>
        <Empty description={error ?? '插件不存在'}>
          <Button onClick={refresh}>重新加载</Button>
        </Empty>
      </div>
    );
  }

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { title: <Link to="/plugins">插件市场</Link> },
          { title: data.name },
        ]}
      />

      <div className={styles.header}>
        <div className={styles.headerMain}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/plugins')}>
            返回
          </Button>
          <div className={styles.identity}>
            {data.iconUrl ? <img src={data.iconUrl} alt="" /> : <span><ApiOutlined /></span>}
            <div>
              <div className={styles.titleLine}>
                <h1>{data.name}</h1>
                <Tag color={statusColor[data.status]}>{statusText[data.status]}</Tag>
                {data.isBuiltin && <Tag color="blue">内置</Tag>}
              </div>
              <p>{data.description}</p>
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button icon={<ReloadOutlined />} onClick={refresh}>
            刷新
          </Button>
          <Popconfirm
            title={data.enabled ? '停用插件' : '启用插件'}
            description={data.enabled ? '停用后，该插件下的所有工具将不可调用。' : '启用后，该插件工具可用于测试和绑定。'}
            okText="确认"
            cancelText="取消"
            onConfirm={() => void handleToggle()}
          >
            <Button type={data.enabled ? 'default' : 'primary'} danger={data.enabled}>
              {data.enabled ? '停用插件' : '启用插件'}
            </Button>
          </Popconfirm>
        </div>
      </div>

      <Descriptions
        bordered
        column={{ xs: 1, sm: 2, lg: 4 }}
        items={[
          { key: 'code', label: '编码', children: data.code },
          { key: 'type', label: '类型', children: typeText[data.type] },
          { key: 'version', label: '版本', children: data.version },
          { key: 'tools', label: '工具数量', children: `${data.activeToolCount}/${data.toolCount}` },
          { key: 'invocation', label: '允许调用', children: data.invocationEnabled ? '是' : '否' },
          { key: 'credentials', label: '凭据', children: `${data.credentialSummary?.activeCount ?? 0}/${data.credentialSummary?.count ?? 0}` },
          { key: 'createdAt', label: '创建时间', children: data.createdAt },
          { key: 'updatedAt', label: '更新时间', children: data.updatedAt },
        ]}
      />

      <div className={styles.toolsBlock}>
        <div className={styles.blockTitle}>
          <h2>工具列表</h2>
          {!data.enabled && <Tag color="default">插件已停用，工具不可用</Tag>}
        </div>
        <Table columns={columns} dataSource={data.tools} rowKey="id" pagination={false} />
      </div>

      <Drawer
        title="工具测试"
        width={560}
        open={Boolean(testingTool)}
        onClose={() => setTestingTool(null)}
        destroyOnHidden
      >
        {testingTool && <ToolTestPanel tool={testingTool} />}
      </Drawer>
    </section>
  );
}
