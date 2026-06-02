import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, InputNumber, Radio, Select, Space, Switch, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ChunkMode,
  IndexMode,
  knowledgeApi,
  RetrievalMode,
  type CreateKnowledgeBasePayload,
  type KnowledgeSourceType,
} from '../../../api/knowledge-base';
import { KbPageHeader } from '../components/KbPageHeader';
import { KnowledgeIconEditor } from '../components/KnowledgeIconEditor';
import { chunkModeText, indexModeText, retrievalModeText, sourceTypeText } from '../components/labels';
import styles from './document.module.css';

type FormValues = CreateKnowledgeBasePayload;

const defaultValues: FormValues = {
  name: '',
  description: '',
  icon: '📘',
  iconType: 'emoji',
  sourceType: 'local_file',
  indexMode: IndexMode.HighQuality,
  chunkConfig: {
    chunkMode: ChunkMode.General,
    chunkSize: 800,
    chunkOverlap: 100,
    separator: '\\n\\n',
    autoClean: true,
  },
  embeddingConfig: {
    embeddingModel: 'text-embedding-3-large',
    embeddingDimension: 3072,
    language: 'zh-CN',
  },
  retrievalConfig: {
    retrievalMode: RetrievalMode.Hybrid,
    topK: 5,
    scoreThreshold: 0.35,
    rerankEnabled: true,
  },
};

function KnowledgeCreate() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const icon = Form.useWatch('icon', form);
  const iconType = Form.useWatch('iconType', form);
  const iconImageUrl = Form.useWatch('iconImageUrl', form);

  const handleFinish = async (values: FormValues) => {
    await knowledgeApi.createKnowledgeBase(values);
    message.success('知识库创建成功');
    navigate('/knowledge');
  };

  return (
    <div className={styles.page}>
      <div className={`${styles.content} ${styles.createPage}`}>
        <KbPageHeader
          title="创建知识库"
          description="按企业 RAG 流程配置数据来源、分段、Embedding、索引和检索策略。"
          actions={
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')}>
              返回
            </Button>
          }
        />

        <Card className={styles.formCard}>
          <Form<FormValues>
            form={form}
            layout="vertical"
            initialValues={defaultValues}
            onFinish={handleFinish}
          >
            <h2 className={styles.sectionTitle}>基础信息</h2>
            <Form.Item name="icon" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="iconType" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="iconImageUrl" hidden>
              <Input />
            </Form.Item>
            <div className={styles.iconFormLayout}>
              <KnowledgeIconEditor
                value={{ icon, iconType, iconImageUrl }}
                onChange={(value) => form.setFieldsValue(value)}
              />
              <div className={styles.formGrid}>
                <Form.Item
                  label="知识库名称"
                  name="name"
                  rules={[{ required: true, message: '请输入知识库名称' }]}
                >
                  <Input placeholder="例如：产品知识库" />
                </Form.Item>
                <Form.Item
                  className={styles.full}
                  label="描述"
                  name="description"
                  rules={[{ required: true, message: '请输入知识库描述' }]}
                >
                  <Input.TextArea rows={3} placeholder="用于描述该知识库的业务范围和使用场景" />
                </Form.Item>
              </div>
            </div>

            <h2 className={styles.sectionTitle}>数据来源</h2>
            <Form.Item name="sourceType">
              <Radio.Group>
                <Radio.Button value={'local_file' satisfies KnowledgeSourceType}>{sourceTypeText.local_file}</Radio.Button>
                <Radio.Button value={'text' satisfies KnowledgeSourceType}>{sourceTypeText.text}</Radio.Button>
                <Radio.Button value={'url' satisfies KnowledgeSourceType}>{sourceTypeText.url}</Radio.Button>
                <Radio.Button value={'notion' satisfies KnowledgeSourceType} disabled>
                  Notion
                </Radio.Button>
                <Radio.Button value={'api_source' satisfies KnowledgeSourceType} disabled>
                  API 数据源
                </Radio.Button>
              </Radio.Group>
            </Form.Item>

            <h2 className={styles.sectionTitle}>索引配置</h2>
            <Form.Item name="indexMode">
              <Radio.Group>
                <Radio.Button value={IndexMode.HighQuality}>{indexModeText[IndexMode.HighQuality]}</Radio.Button>
                <Radio.Button value={IndexMode.Economy}>{indexModeText[IndexMode.Economy]}</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <h2 className={styles.sectionTitle}>分段配置</h2>
            <div className={styles.formGrid}>
              <Form.Item label="分段模式" name={['chunkConfig', 'chunkMode']}>
                <Select
                  options={[
                    { value: ChunkMode.General, label: chunkModeText[ChunkMode.General] },
                    { value: ChunkMode.ParentChild, label: chunkModeText[ChunkMode.ParentChild] },
                    { value: ChunkMode.QA, label: chunkModeText[ChunkMode.QA] },
                  ]}
                />
              </Form.Item>
              <Form.Item label="分隔符" name={['chunkConfig', 'separator']}>
                <Input />
              </Form.Item>
              <Form.Item label="分段长度" name={['chunkConfig', 'chunkSize']}>
                <InputNumber min={100} max={4000} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="重叠长度" name={['chunkConfig', 'chunkOverlap']}>
                <InputNumber min={0} max={1000} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="自动清洗" name={['chunkConfig', 'autoClean']} valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>

            <h2 className={styles.sectionTitle}>Embedding 配置</h2>
            <div className={styles.formGrid}>
              <Form.Item label="Embedding 模型" name={['embeddingConfig', 'embeddingModel']}>
                <Select
                  options={[
                    { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
                    { value: 'bge-large-zh', label: 'bge-large-zh' },
                    { value: 'm3e-base', label: 'm3e-base' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="向量维度" name={['embeddingConfig', 'embeddingDimension']}>
                <InputNumber min={384} max={4096} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="语言" name={['embeddingConfig', 'language']}>
                <Select
                  options={[
                    { value: 'zh-CN', label: '中文' },
                    { value: 'en-US', label: 'English' },
                    { value: 'multi', label: '多语言' },
                  ]}
                />
              </Form.Item>
            </div>

            <h2 className={styles.sectionTitle}>检索配置</h2>
            <div className={styles.formGrid}>
              <Form.Item label="检索方式" name={['retrievalConfig', 'retrievalMode']}>
                <Select
                  options={[
                    { value: RetrievalMode.Vector, label: retrievalModeText[RetrievalMode.Vector] },
                    { value: RetrievalMode.FullText, label: retrievalModeText[RetrievalMode.FullText] },
                    { value: RetrievalMode.Hybrid, label: retrievalModeText[RetrievalMode.Hybrid] },
                  ]}
                />
              </Form.Item>
              <Form.Item label="召回数量" name={['retrievalConfig', 'topK']}>
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="分数阈值" name={['retrievalConfig', 'scoreThreshold']}>
                <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="开启重排序" name={['retrievalConfig', 'rerankEnabled']} valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>

            <Form.Item>
              <Space>
                <Button onClick={() => navigate('/knowledge')}>取消</Button>
                <Button type="primary" htmlType="submit">
                  创建知识库
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}

export { KnowledgeCreate };
