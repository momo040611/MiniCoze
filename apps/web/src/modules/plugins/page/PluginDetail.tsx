import { App, Badge, Breadcrumb, Button, Descriptions, Drawer, Empty, Form, Input, Modal, Popconfirm, Select, Skeleton, Space, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, ApiOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createPluginCredential,
  createPluginTool,
  deletePluginCredential,
  getPluginInvocations,
  listPluginCredentials,
  updatePlugin,
  updatePluginCredential,
  updatePluginTool,
  type IPluginCredential,
  type IPluginCredentialPayload,
  type IPluginInvocation,
  type IPluginTool,
  type PluginCredentialAuthType,
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

const authTypeText: Record<PluginCredentialAuthType, string> = {
  BEARER_TOKEN: 'Bearer Token',
  API_KEY_HEADER: 'API Key Header',
  BASIC_AUTH: 'Basic Auth',
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
  const [credentials, setCredentials] = useState<IPluginCredential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<IPluginCredential | null>(null);
  const [savingCredential, setSavingCredential] = useState(false);
  const [credentialForm] = Form.useForm();
  const credentialAuthType = Form.useWatch('authType', credentialForm);
  const isHttpPlugin = data?.type === 'HTTP';
  // HTTP 工具编辑时保存原始 meta（除 request 外的其它键在保存时保留）。
  const existingToolMetaRef = useRef<Record<string, unknown> | null>(null);

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
    existingToolMetaRef.current = null;
    toolForm.setFieldsValue({
      code: '',
      name: '',
      description: '',
      inputSchema: JSON.stringify({ type: 'object', properties: {}, required: [] }, null, 2),
      outputSchema: '',
      meta: '',
      // HTTP 引导表单默认值
      requestMethod: 'GET',
      requestUrl: '',
      requestHeaders: '',
      requestBody: '',
      responsePath: '',
      timeoutMs: 15000,
    });
    setToolOpen(true);
  };

  const openEditTool = (tool: IPluginTool) => {
    setEditingTool(tool);
    existingToolMetaRef.current = tool.meta;
    const request = data?.type === 'HTTP' ? readToolRequestConfig(tool.meta) : null;
    toolForm.setFieldsValue({
      code: tool.code,
      name: tool.name,
      description: tool.description,
      inputSchema: JSON.stringify(tool.inputSchema, null, 2),
      outputSchema: tool.outputSchema ? JSON.stringify(tool.outputSchema, null, 2) : '',
      meta: tool.meta ? JSON.stringify(tool.meta, null, 2) : '',
      requestMethod: request?.method ?? 'GET',
      requestUrl: request?.url ?? '',
      requestHeaders: request?.headers ? JSON.stringify(request.headers, null, 2) : '',
      requestBody: request?.body !== undefined ? JSON.stringify(request.body, null, 2) : '',
      responsePath: request?.responsePath ?? '',
      timeoutMs: request?.timeoutMs ?? 15000,
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

      // HTTP 插件：由引导字段合成 meta.request，其余 meta 键保留。
      let meta: Record<string, unknown> | null;
      if (data.type === 'HTTP') {
        const request: Record<string, unknown> = {
          method: values.requestMethod ?? 'GET',
          url: (values.requestUrl ?? '').trim(),
        };
        if (values.requestHeaders?.trim()) {
          request.headers = parseJsonField(values.requestHeaders, {});
        }
        if (values.requestBody?.trim()) {
          request.body = parseJsonField(values.requestBody, {});
        }
        if (values.responsePath?.trim()) {
          request.responsePath = values.responsePath.trim();
        }
        if (values.timeoutMs) {
          request.timeoutMs = Number(values.timeoutMs);
        }

        if (!request.url) {
          message.error('HTTP 工具必须填写请求 URL');
          setSavingTool(false);
          return;
        }

        meta = { ...(existingToolMetaRef.current ?? {}), handler: 'http', request };
      } else {
        meta = parseJsonField(values.meta, null) as Record<string, unknown> | null;
      }

      const payload = {
        code: values.code,
        name: values.name,
        description: values.description,
        inputSchema: parseJsonField(values.inputSchema, { type: 'object', properties: {} }) as Record<string, unknown>,
        outputSchema: parseJsonField(values.outputSchema, null) as Record<string, unknown> | null,
        meta,
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

  const loadCredentials = useCallback(async () => {
    if (!pluginId) return;
    setCredentialsLoading(true);
    try {
      setCredentials(await listPluginCredentials(pluginId));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '凭据加载失败');
    } finally {
      setCredentialsLoading(false);
    }
  }, [pluginId, message]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const openCreateCredential = () => {
    setEditingCredential(null);
    credentialForm.setFieldsValue({
      name: '',
      authType: 'BEARER_TOKEN',
      secret: '',
      headerName: 'X-API-Key',
      username: '',
    });
    setCredentialOpen(true);
  };

  const openEditCredential = (credential: IPluginCredential) => {
    setEditingCredential(credential);
    credentialForm.setFieldsValue({
      name: credential.name,
      authType: credential.authType,
      secret: '',
      headerName:
        typeof credential.config?.headerName === 'string' ? credential.config.headerName : 'X-API-Key',
      username: typeof credential.config?.username === 'string' ? credential.config.username : '',
    });
    setCredentialOpen(true);
  };

  const handleSaveCredential = async () => {
    if (!data) return;

    try {
      const values = await credentialForm.validateFields();
      setSavingCredential(true);

      const config: Record<string, unknown> = {};
      if (values.authType === 'API_KEY_HEADER' && values.headerName) {
        config.headerName = values.headerName;
      }
      if (values.authType === 'BASIC_AUTH' && values.username) {
        config.username = values.username;
      }

      const payload: IPluginCredentialPayload = {
        name: values.name,
        authType: values.authType,
        config,
      };
      // 更新时留空表示保持原 secret；创建时必填。
      if (values.secret) payload.secret = values.secret;

      if (editingCredential) {
        await updatePluginCredential(data.id, editingCredential.id, payload);
        message.success('凭据已更新');
      } else {
        await createPluginCredential(data.id, payload);
        message.success('凭据已创建');
      }

      setCredentialOpen(false);
      setEditingCredential(null);
      await Promise.all([loadCredentials(), refresh()]);
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(err instanceof Error ? err.message : '凭据保存失败');
    } finally {
      setSavingCredential(false);
    }
  };

  const handleDeleteCredential = async (credentialId: string) => {
    if (!data) return;
    try {
      await deletePluginCredential(data.id, credentialId);
      message.success('凭据已删除');
      await Promise.all([loadCredentials(), refresh()]);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '凭据删除失败');
    }
  };

  /** 从 meta.request 读取 HTTP 引导表单初始值。 */
  const readToolRequestConfig = (meta: Record<string, unknown> | null) => {
    const request = meta?.request;
    if (!request || typeof request !== 'object') return null;
    return request as {
      method?: string;
      url?: string;
      headers?: Record<string, unknown>;
      body?: unknown;
      responsePath?: string;
      timeoutMs?: number;
    };
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
            HTTP 插件执行时自动取最新的启用凭据解密注入认证头。
          </p>
          {(data.credentialSummary?.count ?? 0) === 0 && data.type === 'HTTP' && (
            <Tag color="orange">HTTP 插件可能需要补充 API Key 或鉴权配置</Tag>
          )}
        </section>
      </div>

      {data.type === 'HTTP' && (
        <div className={styles.toolsBlock}>
          <div className={styles.blockTitle}>
            <h2>凭据管理</h2>
            <Space>
              <Button onClick={() => void loadCredentials()} loading={credentialsLoading}>
                刷新
              </Button>
              <Button type="primary" onClick={openCreateCredential}>新增凭据</Button>
            </Space>
          </div>
          <Table
            columns={[
              { title: '名称', dataIndex: 'name', width: 180 },
              {
                title: '类型',
                dataIndex: 'authType',
                width: 130,
                render: (value: PluginCredentialAuthType) => authTypeText[value] ?? value,
              },
              { title: '掩码', dataIndex: 'maskedHint', width: 200 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 100,
                render: (value: string) => (
                  <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>
                    {value === 'ACTIVE' ? '启用' : '停用'}
                  </Tag>
                ),
              },
              {
                title: '更新时间',
                dataIndex: 'updatedAt',
                width: 170,
              },
              {
                title: '操作',
                width: 150,
                render: (_, record: IPluginCredential) => (
                  <Space>
                    <Button size="small" onClick={() => openEditCredential(record)}>编辑</Button>
                    <Popconfirm
                      title="删除凭据"
                      description="删除后使用该凭据的工具调用将失去认证。"
                      okText="确认"
                      cancelText="取消"
                      onConfirm={() => void handleDeleteCredential(record.id)}
                    >
                      <Button size="small" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            dataSource={credentials}
            rowKey="id"
            loading={credentialsLoading}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无凭据，HTTP 插件需要认证时请先新增" /> }}
          />
        </div>
      )}

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
          {isHttpPlugin ? (
            <>
              <Form.Item
                name="requestUrl"
                label="请求 URL"
                rules={[{ required: true, message: 'HTTP 工具必须填写请求 URL' }]}
                extra="支持 {{参数名}} 插值，如 https://api.example.com/weather?city={{city}}"
              >
                <Input placeholder="https://api.example.com/endpoint?q={{query}}" />
              </Form.Item>
              <Form.Item name="requestMethod" label="请求方法" initialValue="GET">
                <Select
                  options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }))}
                />
              </Form.Item>
              <Form.Item name="requestHeaders" label="请求头 JSON（可选）" extra="值支持 {{参数名}} 插值；认证头由凭据自动注入，无需在此填写">
                <Input.TextArea rows={3} placeholder={'{ "X-Custom": "{{city}}" }'} />
              </Form.Item>
              <Form.Item name="requestBody" label="请求体 JSON（可选，GET/HEAD 忽略）" extra="支持 {{参数名}} 插值">
                <Input.TextArea rows={3} placeholder={'{ "q": "{{query}}" }'} />
              </Form.Item>
              <Form.Item name="responsePath" label="响应截取路径（可选）" extra="点路径取响应片段作为工具结果，如 data.result">
                <Input placeholder="data.result" />
              </Form.Item>
              <Form.Item name="timeoutMs" label="超时（毫秒，上限 30000）" initialValue={15000}>
                <Input type="number" min={1000} max={30000} />
              </Form.Item>
            </>
          ) : (
            <Form.Item name="meta" label="Meta JSON">
              <Input.TextArea rows={4} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={editingCredential ? '编辑凭据' : '新增凭据'}
        open={credentialOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingCredential}
        onOk={() => void handleSaveCredential()}
        onCancel={() => {
          setCredentialOpen(false);
          setEditingCredential(null);
        }}
        destroyOnHidden
      >
        <Form form={credentialForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '名称必填' }]}>
            <Input placeholder="如：生产环境 API Key" />
          </Form.Item>
          <Form.Item name="authType" label="认证类型" rules={[{ required: true }]}>
            <Select
              disabled={Boolean(editingCredential)}
              options={(Object.keys(authTypeText) as PluginCredentialAuthType[]).map((value) => ({
                value,
                label: authTypeText[value],
              }))}
            />
          </Form.Item>
          <Form.Item
            name="secret"
            label={editingCredential ? 'Secret（留空保持原值）' : 'Secret'}
            rules={editingCredential ? [] : [{ required: true, message: 'Secret 必填' }]}
            extra="仅创建/更新时提交，保存后服务端加密存储，页面只显示掩码"
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          {credentialAuthType === 'API_KEY_HEADER' && (
            <Form.Item name="headerName" label="Header 名称" initialValue="X-API-Key">
              <Input placeholder="X-API-Key" />
            </Form.Item>
          )}
          {credentialAuthType === 'BASIC_AUTH' && (
            <Form.Item name="username" label="用户名">
              <Input />
            </Form.Item>
          )}
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
