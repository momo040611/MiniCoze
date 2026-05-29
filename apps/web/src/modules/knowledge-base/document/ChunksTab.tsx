import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Form, Input, Modal, Select, Space, Spin, Switch, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { type ChunkMetadata, type KnowledgeChunk } from '../../../api/knowledge-base';
import { useKnowledgeChunks } from '../hooks/useKnowledgeChunks';
import { useKnowledgeDocuments } from '../hooks/useKnowledgeDocuments';
import styles from './document.module.css';

type ChunksTabProps = {
  knowledgeBaseId: string;
  documentFilter?: string;
  onChanged: () => void;
};

type ChunkFormValues = {
  documentId: string;
  content: string;
  metadataText: string;
};

function parseMetadata(text: string): ChunkMetadata {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<ChunkMetadata>((result, line) => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length > 0) result[key.trim()] = rest.join('=').trim();
      return result;
    }, {});
}

function stringifyMetadata(metadata: ChunkMetadata) {
  return Object.entries(metadata)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n');
}

function ChunksTab({ knowledgeBaseId, documentFilter, onChanged }: ChunksTabProps) {
  const { loading, chunks, create, update, remove, setEnabled } = useKnowledgeChunks(knowledgeBaseId, onChanged);
  const { documents } = useKnowledgeDocuments(knowledgeBaseId);
  const [keyword, setKeyword] = useState('');
  const [documentId, setDocumentId] = useState(documentFilter ?? 'all');
  const [enabledFilter, setEnabledFilter] = useState('all');
  const [embeddingFilter, setEmbeddingFilter] = useState('all');
  const [editing, setEditing] = useState<KnowledgeChunk | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<ChunkFormValues>();

  useEffect(() => {
    if (documentFilter) setDocumentId(documentFilter);
  }, [documentFilter]);

  const documentOptions = useMemo(() => {
    const options = documents.map((document) => ({ value: document.id, label: document.fileName }));
    return [{ value: 'all', label: '全部文档' }, ...options];
  }, [documents]);

  const editableDocumentOptions = useMemo(() => documentOptions.filter((option) => option.value !== 'all'), [documentOptions]);

  const filtered = chunks.filter((chunk) => {
    const matchKeyword = !keyword || chunk.content.toLowerCase().includes(keyword.toLowerCase());
    const matchDocument = documentId === 'all' || chunk.documentId === documentId;
    const matchEnabled = enabledFilter === 'all' || chunk.enabled === (enabledFilter === 'enabled');
    const matchEmbedding = embeddingFilter === 'all' || (chunk.embeddingStatus ?? 'embedded') === embeddingFilter;
    return matchKeyword && matchDocument && matchEnabled && matchEmbedding;
  });

  const openModal = (chunk?: KnowledgeChunk) => {
    setEditing(chunk ?? null);
    form.setFieldsValue({
      documentId: chunk?.documentId ?? (documentId === 'all' ? editableDocumentOptions[0]?.value : documentId),
      content: chunk?.content ?? '',
      metadataText: chunk ? stringifyMetadata(chunk.metadata) : 'source=manual',
    });
    setModalOpen(true);
  };

  const saveChunk = async () => {
    const values = await form.validateFields();
    const selectedDocument = documents.find((document) => document.id === values.documentId);
    if (editing) {
      await update(editing.id, {
        documentId: values.documentId,
        documentName: selectedDocument?.fileName ?? editing.documentName,
        content: values.content,
        metadata: parseMetadata(values.metadataText),
      });
    } else {
      await create({
        documentId: values.documentId,
        documentName: selectedDocument?.fileName,
        content: values.content,
        metadata: parseMetadata(values.metadataText),
      });
    }
    setModalOpen(false);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <Space wrap>
          <Input.Search placeholder="搜索分段内容" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <Select style={{ width: 220 }} value={documentId} options={documentOptions} onChange={setDocumentId} />
          <Select
            style={{ width: 120 }}
            value={enabledFilter}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'enabled', label: '启用' },
              { value: 'disabled', label: '停用' },
            ]}
            onChange={setEnabledFilter}
          />
          <Select
            style={{ width: 150 }}
            value={embeddingFilter}
            options={[
              { value: 'all', label: '全部向量状态' },
              { value: 'embedded', label: '已向量化' },
              { value: 'pending', label: '等待向量化' },
              { value: 'failed', label: '向量化失败' },
            ]}
            onChange={setEmbeddingFilter}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          新增分段
        </Button>
      </div>
      <Spin spinning={loading}>
        {filtered.length === 0 ? (
          <Empty description="暂无分段，上传文档或新增分段后会出现在这里" />
        ) : (
          filtered.map((chunk) => (
            <Card className={styles.chunkCard} key={chunk.id}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <strong>{chunk.documentName}</strong>
                <Space wrap>
                  <Switch
                    checked={chunk.enabled}
                    checkedChildren="启用"
                    unCheckedChildren="停用"
                    onChange={async (checked) => {
                      await setEnabled(chunk.id, checked);
                    }}
                  />
                  <Button icon={<EditOutlined />} onClick={() => openModal(chunk)}>
                    编辑
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      Modal.confirm({
                        title: '删除分段',
                        content: '确认删除该分段吗？',
                        okText: '删除',
                        cancelText: '取消',
                        okButtonProps: { danger: true },
                        onOk: () => remove(chunk.id),
                      });
                    }}
                  />
                </Space>
              </Space>
              <p className={styles.chunkContent}>{chunk.content}</p>
              <div className={styles.tagRow}>
                <Tag>{chunk.tokenCount} tokens</Tag>
                <Tag color={chunk.embeddingStatus === 'failed' ? 'red' : chunk.embeddingStatus === 'pending' ? 'gold' : 'green'}>
                  Embedding: {chunk.embeddingStatus ?? 'embedded'}
                </Tag>
                <Tag color="blue">命中 {chunk.hitCount ?? 0}</Tag>
                <Tag>{chunk.characterCount} 字符</Tag>
                {Object.entries(chunk.metadata).map(([key, value]) => (
                  <Tag key={key}>
                    {key}: {String(value)}
                  </Tag>
                ))}
              </div>
            </Card>
          ))
        )}
      </Spin>
      <Modal
        title={editing ? '编辑分段' : '新增分段'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={saveChunk}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="内容" name="content" rules={[{ required: true, message: '请输入分段内容' }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item label="来源文档" name="documentId" rules={[{ required: true, message: '请选择来源文档' }]}>
            <Select options={editableDocumentOptions} placeholder="请选择来源文档" />
          </Form.Item>
          <Form.Item label="元数据（每行 key=value）" name="metadataText">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export { ChunksTab };
