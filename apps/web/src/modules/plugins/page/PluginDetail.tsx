import { App, Badge, Breadcrumb, Button, Descriptions, Drawer, Empty, Form, Input, Modal, Popconfirm, Skeleton, Space, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, ApiOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  createPluginTool,
  getPluginInvocations,
  updatePlugin,
  updatePluginTool,
  type IPluginInvocation,
  type IPluginTool,
  type PluginStatus,
  type PluginToolStatus,
  type PluginType,
} from '../../../api/plugins';
import { useWorkspace } from '../../workspace/use-workspace';
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
  const { currentWorkspace } = useWorkspace();
  const { data, loading, error, refresh, toggle } = usePluginDetail(pluginId);
  const [testingTool, setTestingTool] = useState<IPluginTool | null>(null);
  const [pluginForm] = Form.useForm();
  const [toolForm] = Form.useForm();
  const [editOpen, setEditOpen] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<IPluginTool | null>(null);
  const [savingPlugin, setSavingPlugin] = useState(false);
  const [savingTool, setSavingTool] = useState(false);
  const [invocations, setInvocations] = useState<IPluginInvocation[]>([]);
  const [invocationTotal, setInvocationTotal] = useState(0);
  const [invocationPage, setInvocationPage] = useState(1);
  const [invocationsLoading, setInvocationsLoading] = useState(false);

  const parseJsonField = (value: unknown, fallback: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    return JSON.parse(value) as unknown;
  };

  const openEditPlugin = () => {
    if (!data) return;
    pluginForm.setFieldsValue({
      name: data.name,
      code: data.code,
      description: data.description,
      iconUrl: data.iconUrl,
      version: data.version,
      invocationEnabled: data.invocationEnabled,
      maskStrategy: JSON.stringify(data.maskStrategy ?? {}, null, 2),
    });
    setEditOpen(true);
  };

  const openCreateTool = () => {
    setEditingTool(null);
    toolForm.setFieldsValue({
      code: '',
      name: '',
      description: '',
      inputSchema: JSON.stringify({ type: 'object', properties: {}, required: [] }, null, 2),
      outputSchema: '',
      meta: '',
    });
    setToolOpen(true);
  };

  const openEditTool = (tool: IPluginTool) => {
    setEditingTool(tool);
    toolForm.setFieldsValue({
      code: tool.code,
      name: tool.name,
      description: tool.description,
      inputSchema: JSON.stringify(tool.inputSchema, null, 2),
      outputSchema: tool.outputSchema ? JSON.stringify(tool.outputSchema, null, 2) : '',
      meta: tool.meta ? JSON.stringify(tool.meta, null, 2) : '',
    });
    setToolOpen(true);
  };

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

  const handleSavePlugin = async () => {
    if (!data) return;

    try {
      const values = await pluginForm.validateFields();
      setSavingPlugin(true);
      await updatePlugin(data.id, {
        code: values.code,
        name: values.name,
        description: values.description,
        iconUrl: values.iconUrl,
        version: values.version,
        invocationEnabled: values.invocationEnabled,
        maskStrategy: parseJsonField(values.maskStrategy, undefined) as Record<string, unknown> | undefined,
      });
      message.success('插件信息已保存');
      setEditOpen(false);
      await refresh();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      if (err instanceof SyntaxError) {
        message.error('脱敏策略 JSON 格式不正确');
        return;
      }
      message.error(err instanceof Error ? err.message : '插件保存失败');
    } finally {
      setSavingPlugin(false);
    }
  };

  const handleSaveTool = async () => {
    if (!data) return;

    try {
      const values = await toolForm.validateFields();
      setSavingTool(true);
      const payload = {
        code: values.code,
        name: values.name,
        description: values.description,
        inputSchema: parseJsonField(values.inputSchema, { type: 'object', properties: {} }) as Record<string, unknown>,
        outputSchema: parseJsonField(values.outputSchema, null) as Record<string, unknown> | null,
        meta: parseJsonField(values.meta, null) as Record<string, unknown> | null,
      };

      if (editingTool) {
        await updatePluginTool(data.id, editingTool.id, payload);
        message.success('工具已保存');
      } else {
        await createPluginTool(data.id, {
          code: payload.code,
          name: payload.name,
          description: payload.description,
          inputSchema: payload.inputSchema,
          outputSchema: payload.outputSchema,
          meta: payload.meta,
        });
        message.success('工具已创建');
      }

      setToolOpen(false);
      setEditingTool(null);
      await refresh();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      if (err instanceof SyntaxError) {
        message.error('Schema / Meta JSON 格式不正确');
        return;
      }
      message.error(err instanceof Error ? err.message : '工具保存失败');
    } finally {
      setSavingTool(false);
    }
  };

  const loadInvocations = async (page = 1) => {
    if (!pluginId || !currentWorkspace?.id) return;

    setInvocationsLoading(true);
    try {
      const result = await getPluginInvocations(pluginId, {
        workspaceId: currentWorkspace.id,
        page,
        pageSize: 10,
      });
      setInvocations(result.list);
      setInvocationTotal(result.total);
      setInvocationPage(result.page);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '调用日志加载失败');
    } finally {
      setInvocationsLoading(false);
    }
  };

  useEffect(() => {
    void loadInvocations(1);
  }, [pluginId, currentWorkspace?.id]);

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
      title: '??',
      key: 'action',
      width: 140,
      render: (_value: unknown, tool) => (
        <Space>
          <Button type="link" disabled={!data?.enabled || !tool.enabled} onClick={() => setTestingTool(tool)}>
            ??
          </Button>
          <Button type="link" onClick={() => openEditTool(tool)}>
            ??
          </Button>
        </Space>
      ),
    },
  ];

  const invocationColumns: ColumnsType<IPluginInvocation> = [
    { title: '??', dataIndex: 'toolCode', key: 'toolCode', width: 160 },
    {
      title: '??',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: IPluginInvocation['status']) => (
        <Tag color={value === 'SUCCESS' ? 'green' : value === 'RUNNING' ? 'blue' : 'red'}>{value}</Tag>
      ),
    },
    {
      title: '??',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 100,
      render: (value: number | null) => (value === null ? '-' : `${value} ms`),
    },
    {
      title: '????',
      dataIndex: 'argsSummary',
      key: 'argsSummary',
      render: (value: unknown) => <pre className={styles.schema}>{JSON.stringify(value, null, 2)}</pre>,
    },
    {
      title: '?? / ??',
      key: 'result',
      render: (_value: unknown, record) => (
        <pre className={styles.schema}>
          {JSON.stringify(record.errorSummary ?? record.outputSummary ?? '-', null, 2)}
        </pre>
      ),
    },
    { title: '????', dataIndex: 'startedAt', key: 'startedAt', width: 180 },
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
          <Button onClick={openEditPlugin}>
            编辑插件
          </Button>
          <Button icon={<ReloadOutlined />} onClick={refresh}>
            刷新
          </Button>
          <Popconfirm
            title={data.enabled ? '停用插件' : '启用插件'}
            description={
              data.enabled
                ? '停用后，该插件下的所有工具将不可调用。'
                : '启用后，该插件工具可用于测试和绑定。'
            }
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

      <div className={styles.infoGrid}>
        <section className={styles.infoPanel}>
          <h2>市场信息</h2>
          <p>{data.description || '暂无说明'}</p>
          <div className={styles.tagLine}>
            <Tag>{typeText[data.type]}</Tag>
            <Tag>{data.version}</Tag>
            <Tag color={data.invocationEnabled ? 'green' : 'orange'}>
              {data.invocationEnabled ? '允许调用' : '禁止调用'}
            </Tag>
            {data.isBuiltin && <Tag color="blue">内置插件</Tag>}
          </div>
        </section>

        <section className={styles.infoPanel}>
          <h2>凭据状态</h2>
          <p>
            当前可用凭据 {data.credentialSummary?.activeCount ?? 0} / {data.credentialSummary?.count ?? 0}。
            后端暂未提供凭据管理接口，前端先展示状态和风险提示。
          </p>
          {(data.credentialSummary?.count ?? 0) === 0 && data.type === 'HTTP' && (
            <Tag color="orange">HTTP 插件可能需要补充 API Key 或鉴权配置</Tag>
          )}
        </section>
      </div>

      <div className={styles.toolsBlock}>
        <div className={styles.blockTitle}>
          <h2>HTTP / Schema 配置</h2>
          <Tag color="default">只读预览</Tag>
        </div>
        <div className={styles.configGrid}>
          <div>
            <strong>脱敏策略</strong>
            <pre className={styles.wideSchema}>{JSON.stringify(data.maskStrategy ?? {}, null, 2)}</pre>
          </div>
          <div>
            <strong>工具 Meta</strong>
            <pre className={styles.wideSchema}>{JSON.stringify(data.tools.map((tool) => ({ code: tool.code, meta: tool.meta ?? {} })), null, 2)}</pre>
          </div>
        </div>
      </div>

      <div className={styles.toolsBlock}>
        <div className={styles.blockTitle}>
          <h2>工具列表</h2>
          {!data.enabled && <Tag color="default">插件已停用，工具不可用</Tag>}
        </div>
          <Button type="primary" onClick={openCreateTool}>Add tool</Button>
        <Table columns={columns} dataSource={data.tools} rowKey="id" pagination={false} />
      </div>


      <div className={styles.toolsBlock}>
        <div className={styles.blockTitle}>
          <h2>Invocation logs</h2>
          <Button onClick={() => void loadInvocations(invocationPage)} loading={invocationsLoading}>
            Refresh logs
          </Button>
        </div>
        <Table
          columns={invocationColumns}
          dataSource={invocations}
          rowKey="id"
          loading={invocationsLoading}
          pagination={{
            current: invocationPage,
            total: invocationTotal,
            pageSize: 10,
            showSizeChanger: false,
            onChange: (page) => void loadInvocations(page),
          }}
        />
      </div>

      <Modal
        title="Edit plugin"
        open={editOpen}
        okText="Save"
        cancelText="Cancel"
        confirmLoading={savingPlugin}
        onOk={() => void handleSavePlugin()}
        onCancel={() => setEditOpen(false)}
        destroyOnHidden
      >
        <Form form={pluginForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Code is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
          <Form.Item name="iconUrl" label="Icon URL">
            <Input />
          </Form.Item>
          <Form.Item name="version" label="Version">
            <Input />
          </Form.Item>
          <Form.Item name="invocationEnabled" label="Invocation enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="maskStrategy" label="Mask strategy JSON">
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingTool ? 'Edit tool' : 'Create tool'}
        open={toolOpen}
        okText="Save"
        cancelText="Cancel"
        width={720}
        confirmLoading={savingTool}
        onOk={() => void handleSaveTool()}
        onCancel={() => setToolOpen(false)}
        destroyOnHidden
      >
        <Form form={toolForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Code is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Description is required' }]}>
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
          <Form.Item name="inputSchema" label="Input schema JSON" rules={[{ required: true, message: 'Input schema is required' }]}>
            <Input.TextArea rows={7} />
          </Form.Item>
          <Form.Item name="outputSchema" label="Output schema JSON">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="meta" label="Meta JSON">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
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
