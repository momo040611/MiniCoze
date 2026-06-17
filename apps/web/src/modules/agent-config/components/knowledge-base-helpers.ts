import type { KnowledgeBase } from '../../../api/knowledge-base';
import { knowledgeApi } from '../../../api/knowledge-base';

/** 从后端加载知识库列表（含真实文档数和片段数） */
export async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
  const response = await knowledgeApi.getKnowledgeBases();
  return response.data.list;
}
