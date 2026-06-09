import { message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  knowledgeApi,
  type CreateKnowledgeBasePayload,
  type KnowledgeBase,
  type UpdateKnowledgeBasePayload,
} from '../../../api/knowledge-base';

function useKnowledgeBases() {
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<KnowledgeBase[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await knowledgeApi.getKnowledgeBases();
      setItems(response.data.list);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('workspace') || error.message.includes('工作空间'))) {
        message.warning('当前工作区为空，已跳过知识库加载');
        return;
      }
      message.error(error instanceof Error ? error.message : '加载知识库失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) => item.name.toLowerCase().includes(value));
  }, [items, keyword]);

  const create = useCallback(async (payload: CreateKnowledgeBasePayload) => {
    await knowledgeApi.createKnowledgeBase(payload);
    message.success('新建知识库成功');
    await load();
  }, [load]);

  const update = useCallback(async (id: string, payload: UpdateKnowledgeBasePayload) => {
    await knowledgeApi.updateKnowledgeBase(id, payload);
    message.success('保存知识库成功');
    await load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await knowledgeApi.deleteKnowledgeBase(id);
    message.success('删除知识库成功');
    await load();
  }, [load]);

  const reorder = useCallback(async (nextVisibleItems: KnowledgeBase[]) => {
    let nextAllItems: KnowledgeBase[] = [];
    setItems((currentItems) => {
      const visibleIds = new Set(nextVisibleItems.map((item) => item.id));
      const visibleQueue = [...nextVisibleItems];
      nextAllItems = currentItems.map((item) => {
        if (!visibleIds.has(item.id)) return item;
        return visibleQueue.shift() ?? item;
      });
      return nextAllItems;
    });
    await knowledgeApi.updateKnowledgeBaseOrder({ ids: nextAllItems.map((item) => item.id) });
    message.success('排序已保存');
  }, []);

  return {
    loading,
    keyword,
    setKeyword,
    items,
    filteredItems,
    load,
    create,
    update,
    remove,
    reorder,
  };
}

export { useKnowledgeBases };
