import { message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  knowledgeApi,
  type ChunkListParams,
  type CreateChunkPayload,
  type KnowledgeChunk,
  type UpdateChunkPayload,
} from '../../../api/knowledge-base';

function useKnowledgeChunks(knowledgeBaseId: string, onChanged?: () => void) {
  const [loading, setLoading] = useState(false);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);

  const load = useCallback(async (params?: ChunkListParams) => {
    setLoading(true);
    try {
      const response = await knowledgeApi.getChunks(knowledgeBaseId, params);
      setChunks(response.data.list);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载分段失败');
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (payload: CreateChunkPayload) => {
    await knowledgeApi.createChunk(knowledgeBaseId, payload);
    message.success('新增分段成功');
    await load();
    onChanged?.();
  }, [knowledgeBaseId, load, onChanged]);

  const update = useCallback(async (chunkId: string, payload: UpdateChunkPayload) => {
    await knowledgeApi.updateChunk(chunkId, payload);
    message.success('保存分段成功');
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const remove = useCallback(async (chunkId: string) => {
    await knowledgeApi.deleteChunk(chunkId);
    message.success('删除分段成功');
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const setEnabled = useCallback(async (chunkId: string, enabled: boolean) => {
    await knowledgeApi.updateChunkStatus(chunkId, enabled);
    message.success(enabled ? '分段已启用' : '分段已停用');
    await load();
  }, [load]);

  return { loading, chunks, load, create, update, remove, setEnabled };
}

export { useKnowledgeChunks };
