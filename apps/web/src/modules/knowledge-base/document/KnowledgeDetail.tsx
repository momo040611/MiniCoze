import { ArrowLeftOutlined, SettingOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Empty, Spin, Tabs, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { knowledgeApi, type KnowledgeBase } from '../../../api/knowledge-base';
import { KbPageHeader } from '../components/KbPageHeader';
import { KnowledgeIcon } from '../components/KnowledgeIcon';
import { chunkModeText, indexModeText, retrievalModeText } from '../components/labels';
import { StatusBadge } from '../components/StatusBadge';
import { PipelineTab } from '../pipeline/PipelineTab';
import { RetrieveTestTab } from '../retrieve-test/RetrieveTestTab';
import { ChunksTab } from './ChunksTab';
import { DocumentsTab } from './DocumentsTab';
import { MetadataTab } from './MetadataTab';
import { SettingsTab } from './SettingsTab';
import styles from './document.module.css';

type DetailTabKey = 'documents' | 'chunks' | 'retrieve' | 'metadata' | 'pipeline' | 'settings';

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function KnowledgeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [base, setBase] = useState<KnowledgeBase | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTabKey>('documents');
  const [documentFilter, setDocumentFilter] = useState<string | undefined>();

  const loadBase = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await knowledgeApi.getKnowledgeBaseById(id);
      setBase(response.data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  if (!id) {
    return <Empty description="缺少知识库 ID" />;
  }

  if (loading && !base) {
    return (
      <div className={styles.page}>
        <Spin />
      </div>
    );
  }

  if (!base) {
    return (
      <div className={styles.page}>
        <Empty description="知识库不存在">
          <Button onClick={() => navigate('/knowledge')}>返回列表</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <KbPageHeader
          title="知识库详情"
          actions={
            <>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')}>
                返回
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => setActiveTab('documents')}>
                上传文档
              </Button>
              <Button icon={<SettingOutlined />} onClick={() => setActiveTab('settings')}>
                设置
              </Button>
            </>
          }
        />

        <Card className={styles.detailHeader}>
          <div className={styles.detailTitleRow}>
            <KnowledgeIcon value={base} size="large" />
            <div>
              <h1>{base.name}</h1>
              <p className={styles.cardDesc}>{base.description}</p>
            </div>
            <StatusBadge status={base.status} />
          </div>
          <Descriptions column={4} size="small">
            <Descriptions.Item label="文档数">{base.documentCount}</Descriptions.Item>
            <Descriptions.Item label="分段数">{base.chunkCount}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTime(base.updatedAt)}</Descriptions.Item>
            <Descriptions.Item label="索引模式">{indexModeText[base.indexMode]}</Descriptions.Item>
          </Descriptions>
          <div className={styles.detailStats}>
            <Tag>{base.embeddingConfig.embeddingModel}</Tag>
            <Tag color="blue">{retrievalModeText[base.retrievalConfig.retrievalMode]}</Tag>
            <Tag>{chunkModeText[base.chunkConfig.chunkMode]}</Tag>
            <Tag>Top K {base.retrievalConfig.topK}</Tag>
          </div>
        </Card>

        <Card className={styles.tabCard}>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as DetailTabKey)}
            items={[
              {
                key: 'documents',
                label: '文档管理',
                children: (
                  <DocumentsTab
                    knowledgeBaseId={base.id}
                    onChanged={loadBase}
                    onViewChunks={(docId) => {
                      setDocumentFilter(docId);
                      setActiveTab('chunks');
                    }}
                  />
                ),
              },
              {
                key: 'chunks',
                label: '分段管理',
                children: (
                  <ChunksTab
                    knowledgeBaseId={base.id}
                    documentFilter={documentFilter}
                    onChanged={loadBase}
                  />
                ),
              },
              {
                key: 'retrieve',
                label: '检索测试',
                children: <RetrieveTestTab knowledgeBaseId={base.id} />,
              },
              {
                key: 'metadata',
                label: '元数据',
                children: <MetadataTab knowledgeBaseId={base.id} />,
              },
              {
                key: 'pipeline',
                label: '处理流水线',
                children: <PipelineTab knowledgeBaseId={base.id} />,
              },
              {
                key: 'settings',
                label: '设置',
                children: <SettingsTab base={base} onChanged={loadBase} />,
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

export { KnowledgeDetail };
