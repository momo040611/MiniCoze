import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChunkMode,
  IndexMode,
  knowledgeApi,
  KnowledgeStatus,
  RetrievalMode,
  type KnowledgeBase,
  type UpdateKnowledgeBasePayload,
} from '../../../api/knowledge-base';
import { KnowledgeIconEditor } from '../components/KnowledgeIconEditor';
import { chunkModeText, indexModeText, knowledgeStatusText, retrievalModeText } from '../components/labels';
import styles from './document.module.css';

type SettingsTabProps = {
  base: KnowledgeBase;
  onChanged: () => void;
};

function SettingsTab({ base, onChanged }: SettingsTabProps) {
  const navigate = useNavigate();
  const [form] = Form.useForm<UpdateKnowledgeBasePayload>();
  const [reindexing, setReindexing] = useState(false);
  const icon = Form.useWatch('icon', form);
  const iconType = Form.useWatch('iconType', form);
  const iconImageUrl = Form.useWatch('iconImageUrl', form);

  useEffect(() => {
    form.setFieldsValue({
      name: base.name,
      description: base.description,
      icon: base.icon ?? '📘',
      iconType: base.iconType ?? (base.iconImageUrl ? 'image' : 'emoji'),
      iconImageUrl: base.iconImageUrl,
      status: base.status,
      indexMode: base.indexMode,
      chunkConfig: base.chunkConfig,
      embeddingConfig: base.embeddingConfig,
      retrievalConfig: base.retrievalConfig,
    });
  }, [base, form]);

  const saveSettings = async () => {
    const values = await form.validateFields();
    await knowledgeApi.updateKnowledgeSettings(base.id, values);
    message.success('设置已保存');
    onChanged();
  };

  const deleteBase = () => {
    Modal.confirm({
      title: '删除知识库',
      content: `确认删除「${base.name}」吗？该操作不可恢复。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await knowledgeApi.deleteKnowledgeBase(base.id);
        navigate('/knowledge');
      },
    });
  };

  const reindexBase = async () => {
    setReindexing(true);
    try {
      await knowledgeApi.reindexKnowledgeBase(base.id);
      message.success('Reindex submitted');
      onChanged();
    } finally {
      setReindexing(false);
    }
  };

  return (
    <>
      <Form form={form} layout="vertical">
        <Card title="基础信息">
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
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select
                  options={Object.values(KnowledgeStatus).map((value) => ({ value, label: knowledgeStatusText[value] }))}
                />
              </Form.Item>
              <Form.Item className={styles.full} name="description" label="描述">
                <Input.TextArea rows={3} />
              </Form.Item>
            </div>
          </div>
        </Card>

        <Card title="索引与分段配置" style={{ marginTop: 16 }}>
          <div className={styles.formGrid}>
            <Form.Item name="indexMode" label="索引模式">
              <Select options={Object.values(IndexMode).map((value) => ({ value, label: indexModeText[value] }))} />
            </Form.Item>
            <Form.Item name={['chunkConfig', 'chunkMode']} label="分段模式">
              <Select options={Object.values(ChunkMode).map((value) => ({ value, label: chunkModeText[value] }))} />
            </Form.Item>
            <Form.Item name={['chunkConfig', 'chunkSize']} label="分段长度">
              <InputNumber min={100} max={4000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name={['chunkConfig', 'chunkOverlap']} label="重叠长度">
              <InputNumber min={0} max={1000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name={['chunkConfig', 'separator']} label="分隔符">
              <Input />
            </Form.Item>
            <Form.Item name={['chunkConfig', 'autoClean']} label="自动清洗" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Card>

        <Card title="Embedding 与检索配置" style={{ marginTop: 16 }}>
          <div className={styles.formGrid}>
            <Form.Item name={['embeddingConfig', 'embeddingModel']} label="Embedding 模型">
              <Input />
            </Form.Item>
            <Form.Item name={['embeddingConfig', 'embeddingDimension']} label="向量维度">
              <InputNumber min={384} max={4096} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name={['embeddingConfig', 'language']} label="语言">
              <Input />
            </Form.Item>
            <Form.Item name={['retrievalConfig', 'retrievalMode']} label="检索方式">
              <Select options={Object.values(RetrievalMode).map((value) => ({ value, label: retrievalModeText[value] }))} />
            </Form.Item>
            <Form.Item name={['retrievalConfig', 'topK']} label="召回数量">
              <InputNumber min={1} max={20} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name={['retrievalConfig', 'scoreThreshold']} label="分数阈值">
              <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name={['retrievalConfig', 'rerankEnabled']} label="开启重排序" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Card>

        <Space style={{ marginTop: 16 }}>
          <Button type="primary" onClick={saveSettings}>
            保存设置
          </Button>
          <Button loading={reindexing} onClick={reindexBase}>
            Reindex
          </Button>
        </Space>
      </Form>

      <div className={styles.dangerZone}>
        <h3>危险区域</h3>
        <p>删除知识库会移除所有文档、分段、元数据与处理流水线日志。</p>
        <Button danger onClick={deleteBase}>
          删除知识库
        </Button>
      </div>
    </>
  );
}

export { SettingsTab };
