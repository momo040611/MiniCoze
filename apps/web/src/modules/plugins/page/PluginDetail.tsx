import { App, Badge, Breadcrumb, Button, Descriptions, Drawer, Empty, Popconfirm, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import type { IPluginTool } from '../../../api/plugins';
import { ToolTestPanel } from '../components/ToolTestPanel';
import { usePluginDetail } from '../hooks/usePluginDetail';
import styles from './PluginDetail.module.css';

export function PluginDetail() {
  const { pluginId } = useParams<{ pluginId: string }>();
  const { message } = App.useApp();
  const { data, loading, error, refresh, toggle } = usePluginDetail(pluginId);
  const [testingTool, setTestingTool] = useState<IPluginTool | null>(null);

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggle(enabled);
      message.success(enabled ? '插件已启用' : '插件已停用');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '插件状态更新失败');
    }
  };

  const columns: ColumnsType<IPluginTool> = [
    {
      title: '工具名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, tool) => (
        <div>
          <strong>{name}</strong>
          <div className={styles.toolId}>{tool.id}</div>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
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
      title: '状态',
      key: 'enabled',
      render: (_value: unknown, tool) =>
        data?.enabled && tool.enabled ? (
          <Badge status="success" text="可用" />
        ) : (
          <Badge status="default" text="不可用" />
        ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_value: unknown, tool) => (
        <Button type="link" disabled={!data?.enabled || !tool.enabled} onClick={() => setTestingTool(tool)}>
          测试
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
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
          { title: <Link to="/plugins">插件管理</Link> },
          { title: data.name },
        ]}
      />

      <div className={styles.header}>
        <div>
          <div className={styles.icon}>{data.icon ?? 'Plugin'}</div>
          <h1>{data.name}</h1>
          <p>{data.description}</p>
        </div>
        <Popconfirm
          title={data.enabled ? '停用插件' : '启用插件'}
          description={data.enabled ? '停用后，该插件下的所有工具将不可用。' : '确认启用该插件？'}
          okText="确认"
          cancelText="取消"
          onConfirm={() => void handleToggle(!data.enabled)}
        >
          <Button type={data.enabled ? 'default' : 'primary'} danger={data.enabled}>
            {data.enabled ? '停用插件' : '启用插件'}
          </Button>
        </Popconfirm>
      </div>

      <Descriptions
        bordered
        column={{ xs: 1, sm: 2, lg: 4 }}
        items={[
          { key: 'name', label: '名称', children: data.name },
          { key: 'version', label: '版本', children: data.version },
          { key: 'status', label: '状态', children: <Tag color={data.enabled ? '#52c41a' : 'default'}>{data.enabled ? '已启用' : '已停用'}</Tag> },
          { key: 'tools', label: '工具数量', children: data.toolCount },
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
