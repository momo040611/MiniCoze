import { message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  knowledgeApi,
  type KnowledgeRetrievalTest,
  type RetrievalResult,
  type RetrieveTestPayload,
} from '../../../api/knowledge-base';

function useRetrievalTest(knowledgeBaseId: string) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RetrievalResult[]>([]);
  const [history, setHistory] = useState<KnowledgeRetrievalTest[]>([]);

  const loadHistory = useCallback(async () => {
    const response = await knowledgeApi.getRetrievalTests(knowledgeBaseId);
    setHistory(response.data);
  }, [knowledgeBaseId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const run = useCallback(async (payload: RetrieveTestPayload) => {
    setLoading(true);
    try {
      const response = await knowledgeApi.testRetrieval(knowledgeBaseId, payload);
      setResults(response.data);
      await loadHistory();
      message.success('检索测试完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '检索测试失败');
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId, loadHistory]);

  return { loading, results, history, run, loadHistory, setResults };
}

export { useRetrievalTest };
