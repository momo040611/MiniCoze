import { PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Statistic, Switch } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChunkMode,
  IndexMode,
  KnowledgeStatus,
  RetrievalMode,
  type KnowledgeBase,
  type KnowledgeSourceType,
  type UpdateKnowledgeBasePayload,
} from '../../../api/knowledge-base';
import { DraggableKnowledgeCardGrid } from '../components/DraggableKnowledgeCardGrid';
import { KbPageHeader } from '../components/KbPageHeader';
import { KnowledgeIconEditor } from '../components/KnowledgeIconEditor';
import { chunkModeText, indexModeText, retrievalModeText, sourceTypeText } from '../components/labels';
import { useKnowledgeBases } from '../hooks/useKnowledgeBases';
import { KnowledgeUploadModal } from './KnowledgeUploadModal';
import styles from './document.module.css';

type EditFormValues = {
  name: string;
  description: string;
  icon: string;
  iconType?: 'emoji' | 'image';
  iconImageUrl?: string;
  indexMode: IndexMode;
  chunkMode: ChunkMode;
  embeddingModel: string;
  retrievalMode: RetrievalMode;
  topK: number;
  scoreThreshold: number;
  rerankEnabled: boolean;
};

function toUpdatePayload(values: EditFormValues): UpdateKnowledgeBasePayload {
  return {
    name: values.name,
    description: values.description,
    icon: values.icon,
    iconType: values.iconType,
    iconImageUrl: values.iconImageUrl,
    indexMode: values.indexMode,
    chunkConfig: {
      chunkMode: values.chunkMode,
      chunkSize: 800,
      chunkOverlap: 100,
      separator: '\\n\\n',
      autoClean: true,
    },
    embeddingConfig: {
      embeddingModel: values.embeddingModel,
      embeddingDimension: values.embeddingModel.includes('large') ? 3072 : 768,
      language: 'zh-CN',
    },
    retrievalConfig: {
      retrievalMode: values.retrievalMode,
      topK: values.topK,
      scoreThreshold: values.scoreThreshold,
      rerankEnabled: values.rerankEnabled,
    },
    status: KnowledgeStatus.Active,
  };
}

function KnowledgeList() {
  const navigate = useNavigate();
  const { loading, keyword, setKeyword, items, update, remove, reorder, load } = useKnowledgeBases();
  const [statusFilter, setStatusFilter] = useState<KnowledgeStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<KnowledgeSourceType | 'all'>('all');
  const [indexFilter, setIndexFilter] = useState<KnowledgeBase['indexStatus'] | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeBase | null>(null);
  const [form] = Form.useForm<EditFormValues>();
  const icon = Form.useWatch('icon', form);
  const iconType = Form.useWatch('iconType', form);
  const iconImageUrl = Form.useWatch('iconImageUrl', form);

  const tagOptions = useMemo(() => {
    const tags = Array.from(new Set(items.flatMap((item) => item.tags ?? [])));
    return [{ value: 'all', label: '全部标签' }, ...tags.map((tag) => ({ value: tag, label: tag }))];
  }, [items]);

  const filteredItems = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    return items.filter((item) => {
      const matchesKeyword = !value || item.name.toLowerCase().includes(value) || item.description.toLowerCase().includes(value);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || item.sourceType === sourceFilter;
      const matchesIndex = indexFilter === 'all' || (item.indexStatus ?? 'ready') === indexFilter;
      const matchesTag = tagFilter === 'all' || item.tags?.includes(tagFilter);
      return matchesKeyword && matchesStatus && matchesSource && matchesIndex && matchesTag;
    });
  }, [indexFilter, items, keyword, sourceFilter, statusFilter, tagFilter]);

  const stats = useMemo(() => {
    return {
      bases: items.length,
      documents: items.reduce((sum, item) => sum + item.documentCount, 0),
      chunks: items.reduce((sum, item) => sum + item.chunkCount, 0),
      vectors: items.reduce((sum, item) => sum + (item.vectorCount ?? item.chunkCount), 0),
    };
  }, [items]);

  const openEdit = (item: KnowledgeBase) => {
    setEditing(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description,
      icon: item.icon ?? '📚',
      iconType: item.iconType ?? (item.iconImageUrl ? 'image' : 'emoji'),
      iconImageUrl: item.iconImageUrl,
      indexMode: item.indexMode,
      chunkMode: item.chunkConfig.chunkMode,
      embeddingModel: item.embeddingConfig.embeddingModel,
      retrievalMode: item.retrievalConfig.retrievalMode,
      topK: item.retrievalConfig.topK,
      scoreThreshold: item.retrievalConfig.scoreThreshold,
      rerankEnabled: item.retrievalConfig.rerankEnabled,
    });
  };

  const handleEditSave = async () => {
    if (!editing) return;
    const values = await form.validateFields();
    await update(editing.id, toUpdatePayload(values));
    setEditing(null);
  };

  const handleDelete = (item: KnowledgeBase) => {
    Modal.confirm({
      title: '删除知识库',
      content: `确认删除「${item.name}」吗？相关文档、分段和元数据会一并删除。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => remove(item.id),
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <KbPageHeader
          title="知识库"
          description="管理企业 RAG 数据集，覆盖文档解析、分段、元数据、处理流水线与检索测试。"
          actions={
            <Space>
              <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>上传文档</Button>
              <Button onClick={() => navigate('/knowledge/pipeline')}>生产流水线</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/knowledge/create')}>
                新建知识库
              </Button>
            </Space>
          }
        />

        <div className={styles.statsGrid}>
          <Card><Statistic title="知识库" value={stats.bases} /></Card>
          <Card><Statistic title="文档数量" value={stats.documents} /></Card>
          <Card><Statistic title="分段数量" value={stats.chunks} /></Card>
          <Card><Statistic title="向量数量" value={stats.vectors} /></Card>
        </div>

        <div className={styles.toolbar}>
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索知识库名称或描述"
              style={{ width: 280 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Select
              style={{ width: 150 }}
              value={statusFilter}
              options={[
                { value: 'all', label: '全部状态' },
                { value: KnowledgeStatus.Active, label: '可用' },
                { value: KnowledgeStatus.Indexing, label: '索引中' },
                { value: KnowledgeStatus.Disabled, label: '停用' },
                { value: KnowledgeStatus.Failed, label: '失败' },
              ]}
              onChange={setStatusFilter}
            />
            <Select
              style={{ width: 160 }}
              value={sourceFilter}
              options={[
                { value: 'all', label: '全部类型' },
                ...Object.entries(sourceTypeText).map(([value, label]) => ({ value, label })),
              ]}
              onChange={setSourceFilter}
            />
            <Select
              style={{ width: 150 }}
              value={tagFilter}
              options={tagOptions}
              onChange={setTagFilter}
            />
            <Select
              style={{ width: 150 }}
              value={indexFilter}
              options={[
                { value: 'all', label: '全部索引' },
                { value: 'ready', label: '索引就绪' },
                { value: 'indexing', label: '索引中' },
                { value: 'failed', label: '索引失败' },
                { value: 'not_started', label: '未索引' },
              ]}
              onChange={setIndexFilter}
            />
          </Space>
        </div>

        <Spin spinning={loading}>
          {filteredItems.length === 0 ? (
            <Card>
              <Empty description="暂无匹配的知识库">
                <Button type="primary" onClick={() => navigate('/knowledge/create')}>创建知识库</Button>
              </Empty>
            </Card>
          ) : (
            <DraggableKnowledgeCardGrid
              items={filteredItems}
              onOrderChange={reorder}
              onOpen={(item) => navigate(`/knowledge/${item.id}`)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </Spin>

        <KnowledgeUploadModal
          open={uploadOpen}
          knowledgeBases={items}
          onClose={() => setUploadOpen(false)}
          onCompleted={() => void load()}
        />

        <Modal
          title="编辑知识库"
          open={Boolean(editing)}
          onCancel={() => setEditing(null)}
          onOk={handleEditSave}
          okText="保存"
          cancelText="取消"
          width={760}
        >
          <Form form={form} layout="vertical">
            <Form.Item name="icon" hidden><Input /></Form.Item>
            <Form.Item name="iconType" hidden><Input /></Form.Item>
            <Form.Item name="iconImageUrl" hidden><Input /></Form.Item>
            <div className={styles.iconFormLayout}>
              <KnowledgeIconEditor value={{ icon, iconType, iconImageUrl }} onChange={(value) => form.setFieldsValue(value)} />
              <div>
                <Form.Item name="name" label="知识库名称" rules={[{ required: true, message: '请输入知识库名称' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="description" label="知识库描述">
                  <Input.TextArea rows={3} />
                </Form.Item>
              </div>
            </div>
            <Form.Item name="indexMode" label="索引模式">
              <Select options={Object.values(IndexMode).map((value) => ({ value, label: indexModeText[value] }))} />
            </Form.Item>
            <Form.Item name="chunkMode" label="分段模式">
              <Select options={Object.values(ChunkMode).map((value) => ({ value, label: chunkModeText[value] }))} />
            </Form.Item>
            <Form.Item name="embeddingModel" label="Embedding 模型">
              <Select
                options={[
                  { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
                  { value: 'bge-large-zh', label: 'bge-large-zh' },
                  { value: 'm3e-base', label: 'm3e-base' },
                ]}
              />
            </Form.Item>
            <Form.Item name="retrievalMode" label="检索方式">
              <Select options={Object.values(RetrievalMode).map((value) => ({ value, label: retrievalModeText[value] }))} />
            </Form.Item>
            <Space>
              <Form.Item name="topK" label="召回数量"><InputNumber min={1} max={20} /></Form.Item>
              <Form.Item name="scoreThreshold" label="分数阈值"><InputNumber min={0} max={1} step={0.05} /></Form.Item>
              <Form.Item name="rerankEnabled" label="启用重排序" valuePropName="checked"><Switch /></Form.Item>
            </Space>
          </Form>
        </Modal>
      </div>
    </div>
  );
}

export { KnowledgeList };
