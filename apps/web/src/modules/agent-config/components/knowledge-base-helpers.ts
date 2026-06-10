import type { KnowledgeBase } from '../../../api/knowledge-base';
import {
  ChunkMode,
  IndexMode,
  KnowledgeStatus,
  RetrievalMode,
} from '../../../api/knowledge-base/types';
import type { ApiEnvelope } from '../../../api/http';
import { http } from '../../../api/http';
import { getCurrentWorkspaceId } from '../../../api/workspace';

/** 后端知识库响应 DTO */
export interface BackendKnowledgeBase {
  id: string;
  workspaceId: string;
  creatorId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 将后端 DTO 映射为前端 KnowledgeBase 类型 */
export function mapBackendKnowledgeBase(item: BackendKnowledgeBase): KnowledgeBase {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    status: item.enabled ? KnowledgeStatus.Active : KnowledgeStatus.Disabled,
    sourceType: 'local_file',
    documentCount: 0,
    chunkCount: 0,
    indexMode: IndexMode.HighQuality,
    chunkConfig: {
      chunkMode: ChunkMode.General,
      chunkSize: 500,
      chunkOverlap: 50,
      separator: '\n',
      autoClean: true,
    },
    embeddingConfig: {
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 1536,
      language: 'zh',
    },
    retrievalConfig: {
      retrievalMode: RetrievalMode.Vector,
      topK: 5,
      scoreThreshold: 0.5,
      rerankEnabled: false,
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/** 从后端加载知识库列表 */
export async function fetchKnowledgeBases(): Promise<KnowledgeBase[]> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<BackendKnowledgeBase[]>>(
    'knowledge/bases',
    { query: { workspaceId } },
  );
  return res.data.map(mapBackendKnowledgeBase);
}
