import { InboxOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import { Button, Form, InputNumber, Modal, Progress, Select, Space, Switch, Tag, message } from 'antd';
import type { DragEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChunkMode,
  DocumentStatus,
  knowledgeApi,
  type KnowledgeBase,
  type ParseConfig,
  type UploadStatus,
} from '../../../api/knowledge-base';
import { knowledgePipelineApi } from '../../../api/knowledge-pipeline';
import styles from './KnowledgeUploadModal.module.css';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md', 'markdown', 'csv', 'json']);

type UploadQueueItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  message?: string;
  knowledgeBaseId: string;
};

type KnowledgeUploadModalProps = {
  open: boolean;
  defaultKnowledgeBaseId?: string;
  knowledgeBases?: KnowledgeBase[];
  onClose: () => void;
  onCompleted?: (knowledgeBaseId: string) => void;
};

const defaultParseConfig: ParseConfig = {
  ocrEnabled: true,
  preserveTable: true,
  extractImageCaption: false,
  chunkMode: ChunkMode.General,
  chunkSize: 800,
  chunkOverlap: 100,
  autoVectorize: true,
};

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isValidFile(file: File) {
  const extension = getExtension(file.name);
  if (!ACCEPTED_EXTENSIONS.has(extension)) {
    return `不支持 ${extension || 'unknown'} 文件类型`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return '文件大小不能超过 20MB';
  }
  return '';
}

function uid() {
  return `upload-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function KnowledgeUploadModal({
  open,
  defaultKnowledgeBaseId,
  knowledgeBases: outerKnowledgeBases,
  onClose,
  onCompleted,
}: KnowledgeUploadModalProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>(outerKnowledgeBases ?? []);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState(defaultKnowledgeBaseId ?? '');
  const [parseConfig, setParseConfig] = useState<ParseConfig>(defaultParseConfig);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef(new Map<string, number>());
  const canceledRef = useRef(new Set<string>());

  useEffect(() => {
    if (outerKnowledgeBases) {
      setKnowledgeBases(outerKnowledgeBases);
      return;
    }
    if (!open) return;
    void knowledgeApi.getKnowledgeBases({ pageSize: 100 })
      .then((response) => {
        setKnowledgeBases(response.data.list);
        setKnowledgeBaseId((current) => current || defaultKnowledgeBaseId || response.data.list[0]?.id || '');
      })
      .catch((error: unknown) => {
        if (error instanceof Error && (error.message.includes('workspace') || error.message.includes('工作空间'))) {
          message.warning('当前工作区为空，已跳过知识库加载');
          return;
        }
        message.error(error instanceof Error ? error.message : '加载知识库失败');
      });
  }, [defaultKnowledgeBaseId, open, outerKnowledgeBases]);

  useEffect(() => {
    if (open && defaultKnowledgeBaseId) {
      setKnowledgeBaseId(defaultKnowledgeBaseId);
    }
  }, [defaultKnowledgeBaseId, open]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearInterval(timer));
    };
  }, []);

  const selectedKnowledgeBase = useMemo(
    () => knowledgeBases.find((item) => item.id === knowledgeBaseId),
    [knowledgeBaseId, knowledgeBases],
  );

  const patchQueueItem = (id: string, patch: Partial<UploadQueueItem>) => {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const runUpload = (item: UploadQueueItem, config: ParseConfig) => {
    patchQueueItem(item.id, { status: 'uploading', progress: 8, message: '上传中' });
    void knowledgePipelineApi.runUploadPipeline(item.knowledgeBaseId, selectedKnowledgeBase?.name);
    let progress = 8;
    const timer = window.setInterval(async () => {
      if (canceledRef.current.has(item.id)) {
        window.clearInterval(timer);
        timersRef.current.delete(item.id);
        return;
      }

      progress += progress < 70 ? 12 : 6;
      if (progress < 88) {
        patchQueueItem(item.id, {
          progress,
          status: progress > 72 ? 'parsing' : 'uploading',
          message: progress > 72 ? '解析中' : '上传中',
        });
        return;
      }

      window.clearInterval(timer);
      timersRef.current.delete(item.id);
      patchQueueItem(item.id, { progress: 92, status: 'parsing', message: '写入知识库' });

      try {
        const response = await knowledgeApi.uploadDocument(item.knowledgeBaseId, item.file, config);
        if (response.data.status === DocumentStatus.Failed) {
          await knowledgePipelineApi.runUploadPipeline(item.knowledgeBaseId, selectedKnowledgeBase?.name, true);
          patchQueueItem(item.id, {
            status: 'failed',
            progress: 100,
            message: response.data.errorMessage ?? '上传或解析失败',
          });
          return;
        }

        patchQueueItem(item.id, { status: 'completed', progress: 100, message: '上传完成' });
        onCompleted?.(item.knowledgeBaseId);
      } catch (error) {
        await knowledgePipelineApi.runUploadPipeline(item.knowledgeBaseId, selectedKnowledgeBase?.name, true);
        patchQueueItem(item.id, {
          status: 'failed',
          progress: 100,
          message: error instanceof Error ? error.message : '上传失败',
        });
      }
    }, 260);
    timersRef.current.set(item.id, timer);
  };

  const addFiles = (files: File[]) => {
    if (!knowledgeBaseId) {
      message.warning('请先选择目标知识库');
      return;
    }

    files.forEach((file) => {
      const invalidReason = isValidFile(file);
      const item: UploadQueueItem = {
        id: uid(),
        file,
        status: invalidReason ? 'failed' : 'queued',
        progress: invalidReason ? 100 : 0,
        message: invalidReason || '等待上传',
        knowledgeBaseId,
      };
      setQueue((current) => [item, ...current]);
      if (!invalidReason) runUpload(item, parseConfig);
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const handleCancel = async (item: UploadQueueItem) => {
    canceledRef.current.add(item.id);
    const timer = timersRef.current.get(item.id);
    if (timer) window.clearInterval(timer);
    timersRef.current.delete(item.id);
    patchQueueItem(item.id, { status: 'canceled', progress: 0, message: '已取消' });
    await knowledgeApi.cancelUpload(item.id);
  };

  const handleRetry = (item: UploadQueueItem) => {
    canceledRef.current.delete(item.id);
    patchQueueItem(item.id, { status: 'queued', progress: 0, message: '等待重试' });
    runUpload(item, parseConfig);
  };

  return (
    <Modal
      title="上传知识库文档"
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={() => setQueue([])}>清空队列</Button>
          <Button type="primary" onClick={onClose}>完成</Button>
        </Space>
      }
      width={860}
    >
      <Form layout="vertical">
        <Form.Item label="目标知识库" required>
          <Select
            value={knowledgeBaseId}
            options={knowledgeBases.map((item) => ({ value: item.id, label: item.name }))}
            onChange={setKnowledgeBaseId}
            placeholder="请选择知识库"
          />
        </Form.Item>
        <div className={styles.configGrid}>
          <Form.Item label="OCR" style={{ marginBottom: 0 }}>
            <Switch checked={parseConfig.ocrEnabled} onChange={(ocrEnabled) => setParseConfig((current) => ({ ...current, ocrEnabled }))} />
          </Form.Item>
          <Form.Item label="保留表格" style={{ marginBottom: 0 }}>
            <Switch checked={parseConfig.preserveTable} onChange={(preserveTable) => setParseConfig((current) => ({ ...current, preserveTable }))} />
          </Form.Item>
          <Form.Item label="提取图片说明" style={{ marginBottom: 0 }}>
            <Switch checked={parseConfig.extractImageCaption} onChange={(extractImageCaption) => setParseConfig((current) => ({ ...current, extractImageCaption }))} />
          </Form.Item>
          <Form.Item label="分段方式" style={{ marginBottom: 0 }}>
            <Select
              value={parseConfig.chunkMode}
              options={[
                { value: ChunkMode.General, label: '通用分段' },
                { value: ChunkMode.ParentChild, label: '父子分段' },
                { value: ChunkMode.QA, label: '问答分段' },
              ]}
              onChange={(chunkMode) => setParseConfig((current) => ({ ...current, chunkMode }))}
            />
          </Form.Item>
          <Form.Item label="chunkSize" style={{ marginBottom: 0 }}>
            <InputNumber min={100} max={4000} value={parseConfig.chunkSize} style={{ width: '100%' }} onChange={(value) => setParseConfig((current) => ({ ...current, chunkSize: Number(value ?? 800) }))} />
          </Form.Item>
          <Form.Item label="chunkOverlap" style={{ marginBottom: 0 }}>
            <InputNumber min={0} max={1000} value={parseConfig.chunkOverlap} style={{ width: '100%' }} onChange={(value) => setParseConfig((current) => ({ ...current, chunkOverlap: Number(value ?? 100) }))} />
          </Form.Item>
        </div>
        <Form.Item label="自动向量化">
          <Switch checked={parseConfig.autoVectorize} onChange={(autoVectorize) => setParseConfig((current) => ({ ...current, autoVectorize }))} />
        </Form.Item>
      </Form>

      <div
        className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div>
          <InboxOutlined style={{ fontSize: 30, color: '#1677ff', marginBottom: 10 }} />
          <strong>拖拽文件到此处，或点击选择文件</strong>
          <span>支持 PDF / DOCX / TXT / Markdown / CSV / JSON，单文件最大 20MB</span>
        </div>
        <input
          ref={inputRef}
          hidden
          multiple
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.currentTarget.value = '';
          }}
        />
      </div>

      <div className={styles.queue}>
        {queue.map((item) => (
          <div className={styles.queueItem} key={item.id}>
            <div className={styles.queueHead}>
              <span className={styles.queueName}>{item.file.name}</span>
              <Space>
                <Tag color={item.status === 'failed' ? 'red' : item.status === 'completed' ? 'green' : item.status === 'canceled' ? 'default' : 'blue'}>
                  {item.status}
                </Tag>
                {item.status === 'uploading' || item.status === 'parsing' ? (
                  <Button size="small" icon={<StopOutlined />} onClick={() => handleCancel(item)}>取消</Button>
                ) : null}
                {item.status === 'failed' || item.status === 'canceled' ? (
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => handleRetry(item)}>重试</Button>
                ) : null}
              </Space>
            </div>
            <Progress percent={item.progress} status={item.status === 'failed' ? 'exception' : item.status === 'completed' ? 'success' : 'active'} />
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export { KnowledgeUploadModal };
