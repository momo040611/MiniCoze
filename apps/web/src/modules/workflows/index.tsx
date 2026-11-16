import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Empty, Form, Input, Modal, Space, Tag, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { ThunderboltOutlined } from '@ant-design/icons';
import {
  createWorkflowRemote,
  deleteWorkflowRemote,
  getWorkflowListRemote,
  type Workflow,
} from '../../api/workflows';
import { useWorkspace } from '../workspace/use-workspace';
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from './templates';
import styles from './index.module.css';

export function WorkflowsPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [workflowList, setWorkflowList] = useState<Workflow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const creatingTemplateRef = useRef(false);
  const [form] = Form.useForm<{ name: string; description?: string }>();

  async function loadWorkflows(workspaceId?: string) {
    if (!workspaceId) {
      setWorkflowList([]);
      return;
    }

    setWorkflowList(await getWorkflowListRemote(workspaceId));
  }

  useEffect(() => {
    loadWorkflows(currentWorkspace?.id);
  }, [currentWorkspace?.id]);

  const filteredList = useMemo(() => {
    const value = keyword.trim();

    if (!value) {
      return workflowList;
    }

    return workflowList.filter((item) => (
      item.name.includes(value) || item.description?.includes(value)
    ));
  }, [workflowList, keyword]);

  async function handleCreate() {
    const values = await form.validateFields();

    setLoading(true);

    try {
      if (!currentWorkspace?.id) {
        message.error('请先选择工作区');
        return;
      }
      const workflow = await createWorkflowRemote({
        ...values,
        workspaceId: currentWorkspace?.id,
      });
      message.success('工作流创建成功');
      setOpen(false);
      form.resetFields();
      navigate(`/workflows/${workflow.id}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFromTemplate(template: WorkflowTemplate) {
    if (creatingTemplateRef.current) {
      return;
    }
    if (!currentWorkspace?.id) {
      message.error('请先选择工作区');
      return;
    }

    creatingTemplateRef.current = true;
    setCreatingTemplateId(template.id);
    try {
      const workflow = await createWorkflowRemote({
        workspaceId: currentWorkspace.id,
        name: template.name,
        description: template.description,
        canvasData: template.canvasData,
      });
      message.success(`已从模板创建：${template.name}`);
      setTemplateOpen(false);
      navigate(`/workflows/${workflow.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '从模板创建失败');
    } finally {
      creatingTemplateRef.current = false;
      setCreatingTemplateId(null);
    }
  }

  async function handleDelete(id: string) {
    Modal.confirm({
      title: '删除工作流',
      content: '删除后该工作流将被归档，列表中不再展示。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        setDeletingId(id);

        try {
          await deleteWorkflowRemote(id);
          setWorkflowList((list) => list.filter((item) => item.id !== id));
          message.success('工作流已删除');
        } finally {
          setDeletingId(null);
        }
      },
    });
  }

  function openWorkflow(id: string) {
    navigate(`/workflows/${id}`);
  }

  const columns: ColumnsType<Workflow> = [
    {
      title: '工作流名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <Button
          type="link"
          className={styles.nameButton}
          onClick={() => openWorkflow(record.id)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text?: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status?: Workflow['status']) => {
        if (status === 'ACTIVE') {
          return <Tag color="green">已启用</Tag>;
        }

        if (status === 'ARCHIVED') {
          return <Tag>已归档</Tag>;
        }

        return <Tag color="blue">草稿</Tag>;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openWorkflow(record.id)}>
            打开
          </Button>
          <Button
            type="link"
            danger
            loading={deletingId === record.id}
            onClick={(event) => {
              event.stopPropagation();
              handleDelete(record.id);
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>工作流管理</h2>
          <p className={styles.desc}>创建、管理和调试你的 Agent 工作流。</p>
        </div>

        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={() => setTemplateOpen(true)}>
            从模板创建
          </Button>
          <Button type="primary" onClick={() => setOpen(true)}>
            新建工作流
          </Button>
        </Space>
      </div>

      <div className={styles.toolbar}>
        <Input.Search
          allowClear
          placeholder="搜索工作流名称或描述"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className={styles.search}
        />
      </div>

      {filteredList.length > 0 ? (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredList}
          pagination={false}
          onRow={(record) => ({
            onClick: () => openWorkflow(record.id),
            style: { cursor: 'pointer' },
          })}
        />
      ) : (
        <Empty description="暂无工作流，点击右上角新建" />
      )}

      <Modal
        title="从模板创建工作流"
        open={templateOpen}
        onCancel={() => setTemplateOpen(false)}
        footer={null}
        width={640}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          {WORKFLOW_TEMPLATES.map((template) => (
            <Card
              key={template.id}
              size="small"
              hoverable
              onClick={() => {
                if (creatingTemplateId) return;
                void handleCreateFromTemplate(template);
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Space size={8} wrap>
                    <strong>{template.name}</strong>
                    {template.readyToRun ? (
                      <Tag color="green">可直接运行</Tag>
                    ) : (
                      <Tag color="orange">需配置</Tag>
                    )}
                    {template.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                  <p style={{ margin: '8px 0 4px', color: '#4b5563', fontSize: 13 }}>
                    {template.description}
                  </p>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>{template.requirement}</span>
                </div>
                <Button
                  type="link"
                  loading={creatingTemplateId === template.id}
                  disabled={Boolean(creatingTemplateId) && creatingTemplateId !== template.id}
                >
                  使用
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Modal>

      <Modal
        title="新建工作流"
        open={open}
        confirmLoading={loading}
        onOk={handleCreate}
        onCancel={() => setOpen(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="工作流名称"
            name="name"
            rules={[{ required: true, message: '请输入工作流名称' }]}
          >
            <Input placeholder="请输入工作流名称" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={4} placeholder="请输入工作流描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
