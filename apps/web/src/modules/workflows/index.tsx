import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Form, Input, Modal, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import {
  createWorkflowRemote,
  deleteWorkflowRemote,
  getWorkflowListRemote,
  type Workflow,
} from '../../api/workflows';
import { useWorkspace } from '../workspace/use-workspace';
import styles from './index.module.css';

export function WorkflowsPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [workflowList, setWorkflowList] = useState<Workflow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

        <Button type="primary" onClick={() => setOpen(true)}>
          新建工作流
        </Button>
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
