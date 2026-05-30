import { DeleteOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Select, Space, Table, Tag, Switch, Tooltip, type TableColumnsType } from 'antd';
import type { Key } from 'react';
import { useMemo, useState } from 'react';
import { DocumentStatus, type KnowledgeDocument } from '../../../api/knowledge-base';
import { StatusBadge } from '../components/StatusBadge';
import { documentStatusText } from '../components/labels';
import { useKnowledgeDocuments } from '../hooks/useKnowledgeDocuments';
import { KnowledgeUploadModal } from './KnowledgeUploadModal';

type DocumentsTabProps = {
  knowledgeBaseId: string;
  onChanged: () => void;
  onViewChunks: (documentId: string) => void;
};

const statusOptions = [
  { value: 'all', label: '全部状态' },
  ...Object.values(DocumentStatus).map((status) => ({ value: status, label: documentStatusText[status] })),
];

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatParseConfig(document: KnowledgeDocument) {
  if (!document.parseConfig) return '-';
  const { chunkMode, chunkSize, chunkOverlap, autoVectorize } = document.parseConfig;
  return `${chunkMode} / ${chunkSize} / overlap ${chunkOverlap}${autoVectorize ? ' / 自动向量化' : ''}`;
}

function DocumentsTab({ knowledgeBaseId, onChanged, onViewChunks }: DocumentsTabProps) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const { loading, documents, load, remove, reparse, retry, setEnabled } = useKnowledgeDocuments(knowledgeBaseId, onChanged);

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(documents.map((document) => document.fileType.toLowerCase())));
    return [{ value: 'all', label: '全部类型' }, ...types.map((type) => ({ value: type, label: type.toUpperCase() }))];
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesKeyword = !normalizedKeyword || document.fileName.toLowerCase().includes(normalizedKeyword);
      const matchesStatus = statusFilter === 'all' || document.status === statusFilter;
      const matchesType = typeFilter === 'all' || document.fileType.toLowerCase() === typeFilter;
      return matchesKeyword && matchesStatus && matchesType;
    });
  }, [documents, keyword, statusFilter, typeFilter]);

  const selectedDocuments = filteredDocuments.filter((document) => selectedRowKeys.includes(document.id));

  const handleDelete = (document: KnowledgeDocument) => {
    Modal.confirm({
      title: '删除文档',
      content: `确认删除「${document.fileName}」吗？对应分段会一并删除。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await remove(document.id);
      },
    });
  };

  const handleBatchDelete = () => {
    Modal.confirm({
      title: '批量删除文档',
      content: `确认删除已选择的 ${selectedRowKeys.length} 个文档吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await Promise.all(selectedRowKeys.map((id) => remove(String(id))));
        setSelectedRowKeys([]);
      },
    });
  };

  const columns: TableColumnsType<KnowledgeDocument> = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      minWidth: 240,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <span>{value}</span>
          {record.errorMessage ? (
            <Tooltip title={record.errorMessage}>
              <Tag color="red" icon={<InfoCircleOutlined />}>失败原因</Tag>
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    { title: '类型', dataIndex: 'fileType', width: 90, render: (value: string) => value.toUpperCase() },
    { title: '大小', dataIndex: 'fileSize', width: 110, render: (value: number) => formatSize(value) },
    { title: '状态', dataIndex: 'status', width: 110, render: (_, record) => <StatusBadge status={record.status} /> },
    { title: '分段数', dataIndex: 'chunkCount', width: 95 },
    { title: '解析参数', width: 260, render: (_, record) => formatParseConfig(record) },
    { title: '上传时间', dataIndex: 'createdAt', width: 170 },
    { title: '更新时间', dataIndex: 'updatedAt', width: 170 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 88,
      render: (_, record) => (
        <Switch
          checked={record.enabled}
          onChange={async (checked) => {
            await setEnabled(record.id, checked);
          }}
        />
      ),
    },
    {
      title: '操作',
      width: 310,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button onClick={() => onViewChunks(record.id)}>查看分段</Button>
          {record.status === DocumentStatus.Failed ? (
            <Button icon={<ReloadOutlined />} onClick={() => retry(record.id)}>
              重试
            </Button>
          ) : (
            <Button icon={<ReloadOutlined />} onClick={() => reparse(record.id)}>
              重新解析
            </Button>
          )}
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索文档"
            style={{ width: 220 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select style={{ width: 150 }} value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
          <Select style={{ width: 140 }} value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
        </Space>
        <Space wrap>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            上传文档
          </Button>
          <Button
            disabled={selectedRowKeys.length === 0}
            onClick={async () => {
              await Promise.all(selectedDocuments.map((document) => reparse(document.id)));
              setSelectedRowKeys([]);
            }}
          >
            批量重新解析
          </Button>
          <Button
            disabled={!selectedDocuments.some((document) => document.status === DocumentStatus.Failed)}
            onClick={async () => {
              await Promise.all(selectedDocuments.filter((document) => document.status === DocumentStatus.Failed).map((document) => retry(document.id)));
              setSelectedRowKeys([]);
            }}
          >
            批量重试失败
          </Button>
          <Button danger disabled={selectedRowKeys.length === 0} onClick={handleBatchDelete}>
            批量删除
          </Button>
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={filteredDocuments}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        scroll={{ x: 1500 }}
      />
      <KnowledgeUploadModal
        open={uploadOpen}
        defaultKnowledgeBaseId={knowledgeBaseId}
        onClose={() => setUploadOpen(false)}
        onCompleted={() => {
          void load();
          onChanged();
        }}
      />
    </>
  );
}

export { DocumentsTab };
