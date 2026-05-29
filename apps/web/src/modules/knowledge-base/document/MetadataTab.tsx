import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, message, Modal, Select, Space, Switch, Table, Tag, type TableColumnsType } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { knowledgeApi, MetadataFieldType, type MetadataField } from '../../../api/knowledge-base';
import { metadataFieldTypeText } from '../components/labels';

type MetadataTabProps = {
  knowledgeBaseId: string;
};

type MetadataFormValues = {
  name: string;
  type: MetadataFieldType;
  description: string;
  tagsText?: string;
  required: boolean;
  filterable: boolean;
  displayInResult: boolean;
  enabled: boolean;
};

function parseTags(tagsText?: string) {
  return (tagsText ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function MetadataTab({ knowledgeBaseId }: MetadataTabProps) {
  const [fields, setFields] = useState<MetadataField[]>([]);
  const [editing, setEditing] = useState<MetadataField | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<MetadataFormValues>();

  const loadFields = useCallback(async () => {
    const response = await knowledgeApi.getMetadataFields(knowledgeBaseId);
    setFields(response.data);
  }, [knowledgeBaseId]);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  const openModal = (field?: MetadataField) => {
    setEditing(field ?? null);
    form.setFieldsValue({
      name: field?.name ?? '',
      type: field?.type ?? MetadataFieldType.String,
      description: field?.description ?? '',
      tagsText: field?.tags?.join(', ') ?? '',
      required: field?.required ?? false,
      filterable: field?.filterable ?? true,
      displayInResult: field?.displayInResult ?? true,
      enabled: field?.enabled ?? true,
    });
    setOpen(true);
  };

  const saveField = async () => {
    const values = await form.validateFields();
    const payload = {
      name: values.name,
      type: values.type,
      description: values.description,
      tags: parseTags(values.tagsText),
      required: values.required,
      filterable: values.filterable,
      displayInResult: values.displayInResult,
      enabled: values.enabled,
    };
    if (editing) {
      await knowledgeApi.updateMetadataField(editing.id, payload);
      message.success('保存元数据字段成功');
    } else {
      await knowledgeApi.createMetadataField(knowledgeBaseId, payload);
      message.success('新增元数据字段成功');
    }
    setOpen(false);
    await loadFields();
  };

  const columns: TableColumnsType<MetadataField> = [
    { title: '字段名', dataIndex: 'name', width: 160 },
    { title: '字段类型', dataIndex: 'type', width: 120, render: (value: MetadataFieldType) => metadataFieldTypeText[value] },
    { title: '描述', dataIndex: 'description' },
    { title: '必填', dataIndex: 'required', width: 80, render: (value?: boolean) => (value ? <Tag color="red">必填</Tag> : <Tag>可选</Tag>) },
    { title: '过滤', dataIndex: 'filterable', width: 90, render: (value?: boolean) => (value ? <Tag color="blue">可过滤</Tag> : <Tag>不参与</Tag>) },
    { title: '结果展示', dataIndex: 'displayInResult', width: 100, render: (value?: boolean) => (value ? <Tag color="green">展示</Tag> : <Tag>隐藏</Tag>) },
    { title: '来源', dataIndex: 'source', width: 100, render: (value?: string) => <Tag>{value ?? 'custom'}</Tag> },
    { title: '标签', dataIndex: 'tags', width: 180, render: (tags?: string[]) => tags?.length ? tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : '-' },
    { title: '更新时间', dataIndex: 'updatedAt', width: 170, render: (value?: string) => value ?? '-' },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (_, record) => (
        <Switch
          checked={record.enabled}
          onChange={async (checked) => {
            await knowledgeApi.updateMetadataField(record.id, { enabled: checked });
            message.success(checked ? '元数据字段已启用' : '元数据字段已停用');
            await loadFields();
          }}
        />
      ),
    },
    {
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '删除元数据字段',
                content: `确认删除「${record.name}」吗？`,
                okText: '删除',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk: async () => {
                  await knowledgeApi.deleteMetadataField(record.id);
                  message.success('删除元数据字段成功');
                  await loadFields();
                },
              });
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => openModal()}>
        新增字段
      </Button>
      <Table rowKey="id" columns={columns} dataSource={fields} pagination={false} scroll={{ x: 1220 }} />
      <Modal
        open={open}
        title={editing ? '编辑元数据字段' : '新增元数据字段'}
        onCancel={() => setOpen(false)}
        onOk={saveField}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="字段名" rules={[{ required: true, message: '请输入字段名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="字段类型">
            <Select options={Object.values(MetadataFieldType).map((value) => ({ value, label: metadataFieldTypeText[value] }))} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="tagsText" label="标签（英文逗号分隔）">
            <Input placeholder="product, retrieval" />
          </Form.Item>
          <Space size={24} wrap>
            <Form.Item name="required" label="是否必填" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="filterable" label="参与检索过滤" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="displayInResult" label="结果中展示" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}

export { MetadataTab };
