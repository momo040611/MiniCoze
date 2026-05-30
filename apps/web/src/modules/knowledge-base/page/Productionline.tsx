import {
  ArrowLeftOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RocketOutlined,
  SaveOutlined,
  ScissorOutlined,
  SettingOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Switch,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { knowledgeApi, type KnowledgeBase } from '../../../api/knowledge-base';
import {
  knowledgePipelineApi,
  type DocumentChunkConfig,
  type DocumentParseConfig,
  type EmbeddingStepConfig,
  type KnowledgePipeline,
  type PipelineRun,
  type PipelineStep,
  type PipelineStepConfig,
  type PipelineStepType,
  type RetrievalTestConfig,
  type TextCleanConfig,
  type VectorStoreConfig,
} from '../../../api/knowledge-pipeline';
import styles from './Productionline.module.css';

const { TextArea } = Input;
const { Text, Title } = Typography;

const statusText: Record<KnowledgePipeline['status'], string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '停用',
};

const stepIcon: Record<PipelineStepType, ReactNode> = {
  file_upload: <CloudUploadOutlined />,
  document_parse: <FileTextOutlined />,
  text_clean: <ScissorOutlined />,
  document_chunk: <ScissorOutlined />,
  metadata_extract: <TagsOutlined />,
  embedding: <SettingOutlined />,
  vector_store: <DatabaseOutlined />,
  retrieval_test: <FileSearchOutlined />,
};

const runStatusText = {
  pending: 'pending',
  running: 'running',
  success: 'success',
  failed: 'failed',
  skipped: 'skipped',
};

function formatTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getConfig<T extends PipelineStepConfig>(step: PipelineStep): T {
  return step.config as T;
}

function Productionline() {
  const navigate = useNavigate();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState('');
  const [pipeline, setPipeline] = useState<KnowledgePipeline | null>(null);
  const [selectedStepId, setSelectedStepId] = useState('');
  const [latestRun, setLatestRun] = useState<PipelineRun | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedKnowledgeBase = useMemo(
    () => knowledgeBases.find((item) => item.id === selectedKnowledgeBaseId),
    [knowledgeBases, selectedKnowledgeBaseId],
  );

  const selectedStep = useMemo(
    () => pipeline?.steps.find((step) => step.id === selectedStepId) ?? pipeline?.steps[0] ?? null,
    [pipeline, selectedStepId],
  );

  const loadPipeline = useCallback(async (knowledgeBaseId: string, knowledgeBaseName?: string) => {
    const [pipelineResponse, runResponse] = await Promise.all([
      knowledgePipelineApi.getPipeline(knowledgeBaseId, knowledgeBaseName),
      knowledgePipelineApi.getLatestRun(knowledgeBaseId),
    ]);
    setPipeline(pipelineResponse.data);
    setSelectedStepId(pipelineResponse.data.steps[0]?.id ?? '');
    setLatestRun(runResponse.data);
  }, []);

  useEffect(() => {
    const loadBases = async () => {
      const response = await knowledgeApi.getKnowledgeBases({ pageSize: 100 });
      setKnowledgeBases(response.data.list);
      const first = response.data.list[0];
      if (first) {
        setSelectedKnowledgeBaseId(first.id);
        await loadPipeline(first.id, first.name);
      }
    };
    void loadBases();
  }, [loadPipeline]);

  const updatePipeline = (patch: Partial<KnowledgePipeline>) => {
    setPipeline((current) => (current ? { ...current, ...patch } : current));
  };

  const updateStep = (stepId: string, patch: Partial<PipelineStep>) => {
    setPipeline((current) => {
      if (!current) return current;
      return {
        ...current,
        steps: current.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
      };
    });
  };

  const updateStepConfig = (stepId: string, config: PipelineStepConfig) => {
    updateStep(stepId, { config });
  };

  const handleKnowledgeBaseChange = async (knowledgeBaseId: string) => {
    const base = knowledgeBases.find((item) => item.id === knowledgeBaseId);
    setSelectedKnowledgeBaseId(knowledgeBaseId);
    await loadPipeline(knowledgeBaseId, base?.name);
  };

  const buildPayload = () => {
    if (!pipeline || !selectedKnowledgeBase) return null;
    return {
      name: pipeline.name,
      description: pipeline.description,
      knowledgeBaseId: selectedKnowledgeBase.id,
      knowledgeBaseName: selectedKnowledgeBase.name,
      steps: pipeline.steps,
    };
  };

  const handleConvert = async () => {
    if (!selectedKnowledgeBase) return;
    setLoading(true);
    try {
      const response = await knowledgePipelineApi.convertPipeline(selectedKnowledgeBase.id, selectedKnowledgeBase.name);
      setPipeline(response.data);
      setSelectedStepId(response.data.steps[0]?.id ?? '');
      message.success('已转换为知识流水线');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setLoading(true);
    try {
      const response = await knowledgePipelineApi.savePipeline({ ...payload, status: 'draft' });
      setPipeline(response.data);
      message.success('流水线草稿已保存');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setLoading(true);
    try {
      const response = await knowledgePipelineApi.publishPipeline(payload);
      setPipeline(response.data.pipeline);
      setLatestRun(response.data.run);
      message.success('流水线已发布，并同步到知识库详情页');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTest = async () => {
    if (!selectedKnowledgeBase) return;
    setLoading(true);
    try {
      const response = await knowledgePipelineApi.runPipeline(selectedKnowledgeBase.id, selectedKnowledgeBase.name);
      setLatestRun(response.data);
      message.success('测试运行已启动');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshRun = async () => {
    if (!selectedKnowledgeBase) return;
    const response = await knowledgePipelineApi.refreshLatestRun(selectedKnowledgeBase.id);
    setLatestRun(response.data);
  };

  const handleRetrySelected = async () => {
    if (!latestRun || !selectedStep) return;
    const response = await knowledgePipelineApi.retryRunStep(latestRun.id, selectedStep.id);
    setLatestRun(response.data);
  };

  if (!pipeline) {
    return (
      <div className={styles.page}>
        <Empty description="暂无知识库，请先创建知识库" />
      </div>
    );
  }

  if (!pipeline.convertedAt) {
    return (
      <div className={styles.entryPage}>
        <Card className={styles.entryCard}>
          <div className={styles.entryLeft}>
            <div>
              <Title level={1}>转换为知识流水线</Title>
              <p>
                您现在可以将当前知识库转换为可配置的知识处理流水线。转换后可以像 Dify / Coze 一样编排解析、清洗、分段、向量化和入库流程，并将执行状态同步到知识库详情页。
              </p>
            </div>
            <div className={styles.entryControls}>
              <Select
                value={selectedKnowledgeBaseId}
                options={knowledgeBases.map((item) => ({ value: item.id, label: item.name }))}
                onChange={handleKnowledgeBaseChange}
              />
              <Space>
                <Button type="primary" size="large" loading={loading} onClick={handleConvert}>
                  转换
                </Button>
                <Text type="warning">此操作无法撤销</Text>
              </Space>
            </div>
          </div>
          <PipelinePreview />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.editorPage}>
      <header className={styles.toolbar}>
        <div>
          <Text type="secondary">Knowledge Pipeline</Text>
          <h1>{pipeline.name}</h1>
          <Space size={8}>
            <Tag color={pipeline.status === 'published' ? 'green' : 'gold'}>{statusText[pipeline.status]}</Tag>
            <Text type="secondary">v{pipeline.version}</Text>
            <Text type="secondary">更新于 {formatTime(pipeline.updatedAt)}</Text>
          </Space>
        </div>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => selectedKnowledgeBase && navigate(`/knowledge/${selectedKnowledgeBase.id}`)}>
            返回详情
          </Button>
          <Button icon={<SaveOutlined />} loading={loading} onClick={handleSaveDraft}>
            保存草稿
          </Button>
          <Button icon={<RocketOutlined />} loading={loading} onClick={handlePublish}>
            发布
          </Button>
          <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={handleRunTest}>
            运行测试
          </Button>
        </Space>
      </header>

      <section className={styles.metaBar}>
        <div className={styles.field}>
          <Text strong>流水线名称</Text>
          <Input value={pipeline.name} onChange={(event) => updatePipeline({ name: event.target.value })} />
        </div>
        <div className={styles.field}>
          <Text strong>所属知识库</Text>
          <Select
            value={selectedKnowledgeBaseId}
            options={knowledgeBases.map((item) => ({ value: item.id, label: item.name }))}
            onChange={handleKnowledgeBaseChange}
          />
        </div>
        <div className={`${styles.field} ${styles.descriptionField}`}>
          <Text strong>描述</Text>
          <TextArea rows={1} value={pipeline.description} onChange={(event) => updatePipeline({ description: event.target.value })} />
        </div>
      </section>

      <section className={styles.editorGrid}>
        <Card
          className={styles.canvasCard}
          title="流程编排"
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleRefreshRun}>
                刷新状态
              </Button>
              <Button onClick={() => setLogOpen(true)}>查看日志</Button>
            </Space>
          }
        >
          {latestRun ? (
            <div className={styles.runBanner}>
              <Text strong>{latestRun.pipelineName} v{latestRun.pipelineVersion}</Text>
              <Progress
                percent={latestRun.progress}
                status={latestRun.status === 'failed' ? 'exception' : latestRun.progress >= 100 ? 'success' : 'active'}
              />
            </div>
          ) : null}
          <div className={styles.canvasScroller}>
            <div className={styles.flowTrack}>
              {pipeline.steps.map((step, index) => {
                const runStep = latestRun?.steps.find((item) => item.stepId === step.id);
                const status = runStep?.status ?? (step.enabled ? 'pending' : 'skipped');
                return (
                  <div className={styles.nodeGroup} key={step.id}>
                    <button
                      type="button"
                      className={`${styles.flowNode} ${styles[`node_${status}`]} ${selectedStep?.id === step.id ? styles.nodeActive : ''}`}
                      onClick={() => setSelectedStepId(step.id)}
                    >
                      <span className={styles.nodeIcon}>{stepIcon[step.type]}</span>
                      <strong>{step.name}</strong>
                      <small>{runStatusText[status]}</small>
                      {!step.enabled ? <Tag>disabled</Tag> : null}
                    </button>
                    {index < pipeline.steps.length - 1 ? <span className={styles.connector}>→</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card title="参数配置" className={styles.configCard}>
          {selectedStep ? (
            <div className={styles.configPanel}>
              <div className={styles.selectedHeader}>
                <span className={styles.nodeIcon}>{stepIcon[selectedStep.type]}</span>
                <div>
                  <h3>{selectedStep.name}</h3>
                  <p>{selectedStep.description}</p>
                </div>
              </div>
              <SwitchRow label="启用节点" checked={selectedStep.enabled} onChange={(enabled) => updateStep(selectedStep.id, { enabled })} />
              <SwitchRow label="失败重试" checked={selectedStep.retryEnabled} onChange={(retryEnabled) => updateStep(selectedStep.id, { retryEnabled })} />
              <NumberRow label="重试次数" value={selectedStep.retryTimes} min={0} max={10} onChange={(retryTimes) => updateStep(selectedStep.id, { retryTimes })} />
              <div className={styles.field}>
                <Text strong>节点名称</Text>
                <Input value={selectedStep.name} onChange={(event) => updateStep(selectedStep.id, { name: event.target.value })} />
              </div>
              <div className={styles.field}>
                <Text strong>节点说明</Text>
                <TextArea rows={3} value={selectedStep.description} onChange={(event) => updateStep(selectedStep.id, { description: event.target.value })} />
              </div>
              {renderStepConfig(selectedStep, updateStepConfig)}
              {latestRun?.steps.find((item) => item.stepId === selectedStep.id)?.status === 'failed' ? (
                <Button danger onClick={handleRetrySelected}>
                  重试失败节点
                </Button>
              ) : null}
            </div>
          ) : (
            <Empty description="请选择节点" />
          )}
        </Card>
      </section>

      <Modal title="执行日志" open={logOpen} onCancel={() => setLogOpen(false)} footer={null} width={720}>
        {latestRun?.logs.length ? (
          <Timeline
            items={latestRun.logs.map((log) => ({
              color: log.level === 'error' ? 'red' : log.level === 'warn' ? 'gold' : 'blue',
              children: `${formatTime(log.createdAt)} · ${log.message}`,
            }))}
          />
        ) : (
          <Empty description="暂无执行日志" />
        )}
      </Modal>
    </div>
  );
}

function PipelinePreview() {
  const nodes = [
    '文件上传',
    '文档解析',
    '文本清洗',
    '分段',
    'Embedding',
    '入库',
  ];

  return (
    <div className={styles.preview}>
      {nodes.map((node, index) => (
        <div className={styles.previewGroup} key={node}>
          <div className={styles.previewNode}>
            <span>{index + 1}</span>
            <strong>{node}</strong>
          </div>
          {index < nodes.length - 1 ? <i /> : null}
        </div>
      ))}
    </div>
  );
}

function renderStepConfig(
  selectedStep: PipelineStep,
  updateStepConfig: (stepId: string, config: PipelineStepConfig) => void,
) {
  if (selectedStep.type === 'document_parse') {
    const config = getConfig<DocumentParseConfig>(selectedStep);
    return (
      <>
        <SwitchRow label="开启 OCR" checked={config.ocrEnabled} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, ocrEnabled: checked })} />
        <SwitchRow label="保留表格" checked={config.preserveTable} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, preserveTable: checked })} />
        <SwitchRow label="提取图片" checked={config.extractImages} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, extractImages: checked })} />
        <div className={styles.field}>
          <Text strong>支持格式</Text>
          <Checkbox.Group
            className={styles.checkboxGroup}
            value={config.supportedFormats}
            options={['PDF', 'DOCX', 'TXT', 'Markdown']}
            onChange={(value) => updateStepConfig(selectedStep.id, { ...config, supportedFormats: value as DocumentParseConfig['supportedFormats'] })}
          />
        </div>
      </>
    );
  }

  if (selectedStep.type === 'text_clean') {
    const config = getConfig<TextCleanConfig>(selectedStep);
    return (
      <>
        <SwitchRow label="去除空行" checked={config.removeBlankLines} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, removeBlankLines: checked })} />
        <SwitchRow label="去除 URL" checked={config.removeUrls} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, removeUrls: checked })} />
        <SwitchRow label="去除邮箱" checked={config.removeEmails} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, removeEmails: checked })} />
        <SwitchRow label="合并多余空格" checked={config.mergeSpaces} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, mergeSpaces: checked })} />
      </>
    );
  }

  if (selectedStep.type === 'document_chunk') {
    const config = getConfig<DocumentChunkConfig>(selectedStep);
    return (
      <>
        <div className={styles.field}>
          <Text strong>分段方式</Text>
          <Select
            value={config.mode}
            options={[
              { value: 'character', label: '按字符' },
              { value: 'heading', label: '按标题' },
              { value: 'markdown', label: '按 Markdown 结构' },
              { value: 'semantic', label: '语义分段' },
            ]}
            onChange={(mode) => updateStepConfig(selectedStep.id, { ...config, mode })}
          />
        </div>
        <NumberRow label="chunkSize" value={config.chunkSize} min={100} max={4000} onChange={(value) => updateStepConfig(selectedStep.id, { ...config, chunkSize: value })} />
        <NumberRow label="chunkOverlap" value={config.chunkOverlap} min={0} max={1000} onChange={(value) => updateStepConfig(selectedStep.id, { ...config, chunkOverlap: value })} />
        <SwitchRow label="父子分段" checked={config.parentChildEnabled} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, parentChildEnabled: checked })} />
      </>
    );
  }

  if (selectedStep.type === 'embedding') {
    const config = getConfig<EmbeddingStepConfig>(selectedStep);
    return (
      <>
        <div className={styles.field}>
          <Text strong>模型选择</Text>
          <Select
            value={config.model}
            options={[
              { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
              { value: 'bge-large', label: 'bge-large' },
              { value: 'custom', label: '自定义' },
            ]}
            onChange={(model) => updateStepConfig(selectedStep.id, { ...config, model })}
          />
        </div>
        <NumberRow label="batchSize" value={config.batchSize} min={1} max={256} onChange={(value) => updateStepConfig(selectedStep.id, { ...config, batchSize: value })} />
        <NumberRow label="失败重试次数" value={config.retryTimes} min={0} max={10} onChange={(value) => updateStepConfig(selectedStep.id, { ...config, retryTimes: value })} />
      </>
    );
  }

  if (selectedStep.type === 'vector_store') {
    const config = getConfig<VectorStoreConfig>(selectedStep);
    return (
      <>
        <div className={styles.field}>
          <Text strong>向量库类型</Text>
          <Select
            value={config.type}
            options={['Mock', 'Milvus', 'Qdrant', 'PGVector'].map((value) => ({ value, label: value }))}
            onChange={(type) => updateStepConfig(selectedStep.id, { ...config, type })}
          />
        </div>
        <div className={styles.field}>
          <Text strong>索引模式</Text>
          <Select
            value={config.indexMode}
            options={[
              { value: 'high_quality', label: '高质量索引' },
              { value: 'high_performance', label: '高性能索引' },
            ]}
            onChange={(indexMode) => updateStepConfig(selectedStep.id, { ...config, indexMode })}
          />
        </div>
        <SwitchRow label="开启混合检索" checked={config.hybridSearchEnabled} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, hybridSearchEnabled: checked })} />
      </>
    );
  }

  if (selectedStep.type === 'retrieval_test') {
    const config = getConfig<RetrievalTestConfig>(selectedStep);
    return (
      <>
        <NumberRow label="Top K" value={config.topK} min={1} max={20} onChange={(value) => updateStepConfig(selectedStep.id, { ...config, topK: value })} />
        <NumberRow label="Score Threshold" value={config.scoreThreshold} min={0} max={1} step={0.05} onChange={(value) => updateStepConfig(selectedStep.id, { ...config, scoreThreshold: value })} />
        <SwitchRow label="开启 Rerank" checked={config.rerankEnabled} onChange={(checked) => updateStepConfig(selectedStep.id, { ...config, rerankEnabled: checked })} />
      </>
    );
  }

  return <Empty description="该节点暂无额外参数" />;
}

type SwitchRowProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SwitchRow({ label, checked, onChange }: SwitchRowProps) {
  return (
    <div className={styles.inlineField}>
      <Text strong>{label}</Text>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

type NumberRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

function NumberRow({ label, value, min, max, step, onChange }: NumberRowProps) {
  return (
    <div className={styles.field}>
      <Text strong>{label}</Text>
      <InputNumber
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ width: '100%' }}
        onChange={(nextValue) => onChange(Number(nextValue ?? min))}
      />
    </div>
  );
}

export { Productionline };
