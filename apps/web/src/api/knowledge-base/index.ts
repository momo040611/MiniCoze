// 知识库 API — 对接后端真实接口
// 后端：/api/knowledge/bases, /api/knowledge/bases/:id/documents, /api/knowledge/retrieval

import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from '../workspace';
import type {
  CreateKnowledgeBasePayload,
  UpdateKnowledgeBasePayload,
  ListParams,
  DocumentListParams,
  ChunkListParams,
  RetrieveTestPayload,
  ParseConfig,
  UpdateChunkPayload,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeStatus,
  DocumentStatus,
} from './types';
import {
  RetrievalMode,
  IndexMode,
  ChunkMode,
} from './types';

export * from './types';

// ── 后端响应类型 ──

interface BackendKnowledgeBase {
  id: string;
  workspaceId: string;
  creatorId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BackendDocument {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  fileType: string;
  chunkCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface BackendChunk {
  id: string;
  content: string;
  index: number;
  enabled: boolean;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

interface BackendRetrievedChunk {
  chunkId: string;
  knowledgeBaseId: string;
  documentId: string;
  documentName: string;
  index: number;
  content: string;
  score: number;
}

// ── 映射函数：后端 → 前端类型 ──

function mapKnowledgeBase(kb: BackendKnowledgeBase): KnowledgeBase {
  return {
    id: kb.id,
    name: kb.name,
    description: kb.description ?? '',
    status: (kb.enabled ? 'active' : 'disabled') as KnowledgeStatus,
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
      embeddingModel: 'default',
      embeddingDimension: 1024,
      language: 'zh',
    },
    retrievalConfig: {
      retrievalMode: RetrievalMode.Vector,
      topK: 5,
      scoreThreshold: 0.3,
      rerankEnabled: false,
    },
    createdAt: kb.createdAt,
    updatedAt: kb.updatedAt,
  };
}

function mapDocument(doc: BackendDocument): KnowledgeDocument {
  return {
    id: doc.id,
    knowledgeBaseId: doc.knowledgeBaseId,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: 0,
    status: (doc.status?.toLowerCase() || 'completed') as DocumentStatus,
    chunkCount: doc.chunkCount ?? 0,
    enabled: true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function mapChunk(
  chunk: BackendChunk,
  documentId: string,
  knowledgeBaseId: string,
  documentName: string,
): KnowledgeChunk {
  return {
    id: chunk.id,
    knowledgeBaseId,
    documentId,
    documentName,
    content: chunk.content,
    tokenCount: chunk.tokenCount ?? 0,
    characterCount: chunk.content.length,
    metadata: (chunk.metadata as Record<string, string | number | boolean>) ?? {},
    enabled: chunk.enabled ?? true,
    createdAt: '',
    updatedAt: '',
  };
}

// ── API 实现 ──

async function getWorkspacePrefix(): Promise<string> {
  const workspaceId = await getCurrentWorkspaceId();
  return `knowledge/bases`;
}

// ── 包装响应格式（与 mock 保持一致） ──

function ok<T>(data: T): { code: number; message: string; data: T } {
  return { code: 0, message: 'ok', data };
}

export const knowledgeApi = {
  // ═══ 知识库 CRUD ═══

  async getKnowledgeBases(params?: ListParams) {
    const workspaceId = await getCurrentWorkspaceId();
    const res = await http.get<ApiEnvelope<BackendKnowledgeBase[]>>(
      'knowledge/bases',
      { query: { workspaceId } },
    );
    const list = (res.data ?? []).map(mapKnowledgeBase);
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 50;
    return ok({
      list,
      total: list.length,
      page,
      pageSize,
    });
  },

  async getKnowledgeBaseById(id: string) {
    try {
      const res = await this.getKnowledgeBases();
      const found = res.data.list.find((kb) => kb.id === id) ?? null;
      return ok(found);
    } catch {
      return ok(null);
    }
  },

  async createKnowledgeBase(payload: CreateKnowledgeBasePayload) {
    const workspaceId = await getCurrentWorkspaceId();
    const res = await http.post<ApiEnvelope<BackendKnowledgeBase>>(
      'knowledge/bases',
      {
        workspaceId,
        name: payload.name,
        description: payload.description || undefined,
      },
    );
    return ok(mapKnowledgeBase(res.data));
  },

  async updateKnowledgeBase(id: string, payload: UpdateKnowledgeBasePayload) {
    // 后端暂无 update 接口，返回当前数据
    const res = await this.getKnowledgeBaseById(id);
    if (!res.data) throw new Error('知识库不存在');
    return ok(res.data);
  },

  async deleteKnowledgeBase(id: string): Promise<void> {
    await http.delete(`knowledge/bases/${id}`);
  },

  async updateKnowledgeBaseOrder(_payload: { ids: string[] }): Promise<void> {
    // 后端暂不支持排序
  },

  async updateKnowledgeSettings(id: string, payload: UpdateKnowledgeBasePayload) {
    return this.updateKnowledgeBase(id, payload);
  },

  // ═══ 文档管理 ═══

  async getDocuments(knowledgeBaseId: string, params?: DocumentListParams) {
    const res = await http.get<ApiEnvelope<{ list: BackendDocument[] }>>(
      `knowledge/bases/${knowledgeBaseId}/documents`,
    );
    const list = (res.data?.list ?? []).map(mapDocument);
    return ok({ list, total: list.length });
  },

  async uploadDocument(knowledgeBaseId: string, file: File, parseConfig?: ParseConfig) {
    // 第一步：上传文件
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'KNOWLEDGE_DOCUMENT');

    const uploadRes = await http.request<ApiEnvelope<{ id: string }>>('files/upload', {
      method: 'POST',
      body: formData as unknown as Record<string, unknown>,
      headers: {},
    });

    const fileId = uploadRes.data.id;

    // 第二步：调用文档入库接口
    const res = await http.post<ApiEnvelope<{ documents: BackendDocument[] }>>(
      `knowledge/bases/${knowledgeBaseId}/documents`,
      {
        fileId,
        config: parseConfig ? {
          chunkSize: parseConfig.chunkSize,
          chunkOverlap: parseConfig.chunkOverlap,
        } : undefined,
      },
    );

    const doc = res.data?.documents?.[0];
    if (!doc) throw new Error('文档上传失败');
    return ok(mapDocument(doc));
  },

  async deleteDocument(documentId: string): Promise<void> {
    await http.delete(`knowledge/documents/${documentId}`);
  },

  async reparseDocument(documentId: string): Promise<void> {
    // 后端暂不支持重新解析
  },

  async retryDocument(documentId: string): Promise<void> {
    // 后端暂不支持重试
  },

  async cancelUpload(taskId: string): Promise<void> {
    // 后端暂不支持取消上传
  },

  async getUploadTasks(knowledgeBaseId?: string): Promise<unknown[]> {
    return [];
  },

  async updateDocumentStatus(documentId: string, enabled: boolean): Promise<void> {
    // 后端暂不支持文档状态切换
  },

  // ═══ 切片管理 ═══

  async getChunks(knowledgeBaseId: string, params?: ChunkListParams) {
    // 需要先获取文档列表，再获取每个文档的切片
    const docsRes = await this.getDocuments(knowledgeBaseId);
    const docs = docsRes.data.list;
    if (docs.length === 0) return ok({ list: [] as KnowledgeChunk[], total: 0 });

    const docId = params?.documentId ?? docs[0].id;
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 50;

    const res = await http.get<ApiEnvelope<{ list: BackendChunk[]; total: number }>>(
      `knowledge/documents/${docId}/chunks/page`,
      { query: { page, pageSize } },
    );

    const list = (res.data?.list ?? []).map((c) =>
      mapChunk(c, docId, knowledgeBaseId, docs.find((d) => d.id === docId)?.fileName ?? ''),
    );
    return ok({ list, total: res.data?.total ?? list.length });
  },

  async createChunk(knowledgeBaseId: string, payload: { documentId?: string; content: string; metadata: Record<string, unknown> }): Promise<KnowledgeChunk> {
    throw new Error('暂不支持手动创建切片');
  },

  async updateChunk(chunkId: string, payload: UpdateChunkPayload): Promise<void> {
    // chunkId 格式：documentId:index
    // 后端使用 documentId + index 来定位切片
    // 这里需要从调用方传入正确的参数
    // 暂不实现
  },

  async deleteChunk(chunkId: string): Promise<void> {
    // 暂不实现
  },

  async updateChunkStatus(chunkId: string, enabled: boolean): Promise<void> {
    // 暂不实现
  },

  // ═══ 检索测试 ═══

  async testRetrieve(knowledgeBaseId: string, payload: RetrieveTestPayload) {
    const res = await http.post<ApiEnvelope<{ results: BackendRetrievedChunk[] }>>(
      'knowledge/retrieval',
      {
        knowledgeBaseIds: [knowledgeBaseId],
        query: payload.query,
        topK: payload.topK ?? 5,
        minScore: payload.scoreThreshold ?? 0.3,
      },
    );
    // 映射后端结果为前端 RetrievalResult 格式
    const results = (res.data?.results ?? []).map((r, i) => ({
      rank: i + 1,
      score: r.score,
      documentName: r.documentName,
      chunkContent: r.content,
      metadata: {},
      tokenCount: 0,
    }));
    return ok(results);
  },

  async testRetrieval(knowledgeBaseId: string, payload: RetrieveTestPayload) {
    return this.testRetrieve(knowledgeBaseId, payload);
  },

  async getRetrievalTests(knowledgeBaseId: string) {
    return ok([]);
  },

  // ═══ 元数据字段（后端暂不支持） ═══

  async getMetadataFields(knowledgeBaseId: string) {
    return ok([]);
  },

  async createMetadataField(knowledgeBaseId: string, payload: unknown): Promise<unknown> {
    throw new Error('暂不支持');
  },

  async updateMetadataField(fieldId: string, payload: unknown): Promise<unknown> {
    throw new Error('暂不支持');
  },

  async deleteMetadataField(fieldId: string): Promise<void> {
    throw new Error('暂不支持');
  },

  // ═══ 流水线任务（后端暂不支持） ═══

  async getPipelineTasks(knowledgeBaseId: string): Promise<unknown[]> {
    return [];
  },
};
