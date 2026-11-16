import { message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  knowledgeApi,
  type DocumentListParams,
  type KnowledgeDocument,
  type ParseConfig,
} from '../../../api/knowledge-base';

// 非终态文档（处理中）出现时自动轮询刷新列表，直到全部到达终态。
const NON_TERMINAL_STATUSES = new Set(['PROCESSING', 'PARSED', 'CHUNKED', 'EMBEDDING']);
const POLL_INTERVAL_MS = 3000;

function useKnowledgeDocuments(knowledgeBaseId: string, onChanged?: () => void) {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);

  const load = useCallback(async (params?: DocumentListParams) => {
    setLoading(true);
    try {
      const response = await knowledgeApi.getDocuments(knowledgeBaseId, params);
      setDocuments(response.data.list);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载文档失败');
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 有处理中的文档时轮询刷新，全部到达 READY/FAILED 后停止。
  const hasProcessing = documents.some((d) => NON_TERMINAL_STATUSES.has(d.status));
  useEffect(() => {
    if (!hasProcessing) {
      return;
    }
    const timer = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasProcessing, load]);

  const upload = useCallback(async (file: File, parseConfig?: ParseConfig) => {
    setLoading(true);
    try {
      await knowledgeApi.uploadDocument(knowledgeBaseId, file, parseConfig);
      message.success('上传成功，文档已进入处理流水线');
      await load();
      onChanged?.();
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId, load, onChanged]);

  const remove = useCallback(async (documentId: string) => {
    await knowledgeApi.deleteDocument(documentId);
    message.success('删除文档成功');
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const reparse = useCallback(async (documentId: string) => {
    message.info('文档重新解析中');
    await knowledgeApi.reparseDocument(documentId);
    message.success('文档解析完成');
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const retry = useCallback(async (documentId: string) => {
    message.info('正在重试失败文档');
    await knowledgeApi.retryDocument(documentId);
    message.success('重试完成');
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const setEnabled = useCallback(async (documentId: string, enabled: boolean) => {
    await knowledgeApi.updateDocumentStatus(documentId, enabled);
    message.success(enabled ? '文档已启用' : '文档已停用');
    await load();
    onChanged?.();
  }, [load, onChanged]);

  return { loading, documents, load, upload, remove, reparse, retry, setEnabled };
}

export { useKnowledgeDocuments };
