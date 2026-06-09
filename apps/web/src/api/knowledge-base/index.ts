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
  originalName: string;
  fileExtension: string;
  fileSize: number;
  chunkType: string;
  chunkConfig: Record<string, unknown>;
  totalChunks: number;
  totalChars: number;
  createdAt: string;
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
    fileName: doc.originalName,
    fileType: doc.fileExtension,
    fileSize: doc.fileSize ?? 0,
    status: 'completed' as DocumentStatus,
    chunkCount: doc.totalChunks ?? 0,
    enabled: true,
    createdAt: doc.createdAt,
    updatedAt: doc.createdAt,
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

function ok<T>(data: T): { code: number; message: string; data: T } {
  return { code: 0, message: 'ok', data };
}

export const knowledgeApi = {
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
    const res = await this.getKnowledgeBaseById(id);
    if (!res.data) throw new Error('知识库不存在');
    return ok(res.data);
  },

  async deleteKnowledgeBase(id: string): Promise<void> {
    await http.delete(`knowledge/bases/${id}`);
  },

  async updateKnowledgeBaseOrder(_payload: { ids: string[] }): Promise<void> {},

  async updateKnowledgeSettings(id: string, payload: UpdateKnowledgeBasePayload) {
    return this.updateKnowledgeBase(id, payload);
  },

  async getDocuments(knowledgeBaseId: string, params?: DocumentListParams) {
    const res = await http.get<ApiEnvelope<{ list: BackendDocument[] }>>(
      `knowledge/bases/${knowledgeBaseId}/documents`,
    );
    const list = (res.data?.list ?? []).map(mapDocument);
    return ok({ list, total: list.length });
  },

  async uploadDocument(knowledgeBaseId: string, file: File, parseConfig?: ParseConfig) {
    const workspaceId = await getCurrentWorkspaceId();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'KNOWLEDGE_DOCUMENT');
    formData.append('workspaceId', workspaceId);

    const uploadRes = await http.request<ApiEnvelope<{ id: string }>>('files/upload', {
      method: 'POST',
      body: formData as unknown as Record<string, unknown>,
      headers: {},
    });

    const fileId = uploadRes.data?.id;
    if (!fileId) throw new Error('文件上传失败：未获取到 fileId');

    const res = await http.post<ApiEnvelope<{ document: BackendDocument; chunkSummary: { totalChunks: number; totalChars: number } }>>(
      `knowledge/bases/${knowledgeBaseId}/documents`,
      {
        fileId,
        config: parseConfig
          ? {
              chunkType: 'custom',
              chunkSize: parseConfig.chunkSize,
              overlap: parseConfig.chunkSize > 0
                ? Math.min(99, Math.round((parseConfig.chunkOverlap / parseConfig.chunkSize) * 100))
                : 0,
            }
          : { chunkType: 'default' },
      },
    );

    const doc = res.data?.document;
    if (!doc) throw new Error('文档上传失败');
    return ok(mapDocument(doc));
  },

  async deleteDocument(documentId: string): Promise<void> {
    await http.delete(`knowledge/documents/${documentId}`);
  },

  async reparseDocument(documentId: string): Promise<void> {},
  async retryDocument(documentId: string): Promise<void> {},
  async cancelUpload(taskId: string): Promise<void> {},
  async getUploadTasks(knowledgeBaseId?: string): Promise<unknown[]> { return []; },
  async updateDocumentStatus(documentId: string, enabled: boolean): Promise<void> {},

  async getChunks(knowledgeBaseId: string, params?: ChunkListParams) {
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

  async updateChunk(chunkId: string, payload: UpdateChunkPayload): Promise<void> {},
  async deleteChunk(chunkId: string): Promise<void> {},
  async updateChunkStatus(chunkId: string, enabled: boolean): Promise<void> {},

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

  async getPipelineTasks(knowledgeBaseId: string): Promise<unknown[]> {
    return [];
  },
};
