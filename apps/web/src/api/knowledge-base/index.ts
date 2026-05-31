import { knowledgeMock } from './mock';
import type {
  CreateChunkPayload,
  CreateKnowledgeBasePayload,
  CreateMetadataFieldPayload,
  ChunkListParams,
  DocumentListParams,
  ListParams,
  RetrieveTestPayload,
  ParseConfig,
  UpdateChunkPayload,
  UpdateKnowledgeBasePayload,
  UpdateKnowledgeBaseOrderPayload,
  UpdateMetadataFieldPayload,
} from './types';

export * from './types';

export const knowledgeApi = {
  // TODO: 后续替换为 request.get('/api/knowledge-bases', { query: params })
  // 当前阶段使用 mockKnowledgeApi.getKnowledgeBases(params)
  getKnowledgeBases: (params?: ListParams) =>
    knowledgeMock.getKnowledgeBases(params),
  getKnowledgeBaseById: (id: string) => knowledgeMock.getKnowledgeBaseById(id),
  // TODO: 后续替换为 request.post('/api/knowledge-bases', payload)
  createKnowledgeBase: (payload: CreateKnowledgeBasePayload) => knowledgeMock.createKnowledgeBase(payload),
  updateKnowledgeBase: (id: string, payload: UpdateKnowledgeBasePayload) =>
    knowledgeMock.updateKnowledgeBase(id, payload),
  deleteKnowledgeBase: (id: string) => knowledgeMock.deleteKnowledgeBase(id),
  updateKnowledgeBaseOrder: (payload: UpdateKnowledgeBaseOrderPayload) =>
    knowledgeMock.updateKnowledgeBaseOrder(payload),
  updateKnowledgeSettings: (id: string, payload: UpdateKnowledgeBasePayload) =>
    knowledgeMock.updateKnowledgeBase(id, payload),

  getDocuments: (knowledgeBaseId: string, params?: DocumentListParams) =>
    knowledgeMock.getDocuments(knowledgeBaseId, params),
  uploadDocument: (knowledgeBaseId: string, file: File, parseConfig?: ParseConfig) =>
    knowledgeMock.uploadDocument(knowledgeBaseId, file, parseConfig),
  deleteDocument: (documentId: string) => knowledgeMock.deleteDocument(documentId),
  reparseDocument: (documentId: string) => knowledgeMock.reparseDocument(documentId),
  retryDocument: (documentId: string) => knowledgeMock.retryDocument(documentId),
  cancelUpload: (taskId: string) => knowledgeMock.cancelUpload(taskId),
  getUploadTasks: (knowledgeBaseId?: string) => knowledgeMock.getUploadTasks(knowledgeBaseId),
  updateDocumentStatus: (documentId: string, enabled: boolean) =>
    knowledgeMock.updateDocumentStatus(documentId, enabled),

  getChunks: (knowledgeBaseId: string, params?: ChunkListParams) => knowledgeMock.getChunks(knowledgeBaseId, params),
  createChunk: (knowledgeBaseId: string, payload: CreateChunkPayload) =>
    knowledgeMock.createChunk(knowledgeBaseId, payload),
  updateChunk: (chunkId: string, payload: UpdateChunkPayload) => knowledgeMock.updateChunk(chunkId, payload),
  deleteChunk: (chunkId: string) => knowledgeMock.deleteChunk(chunkId),
  updateChunkStatus: (chunkId: string, enabled: boolean) => knowledgeMock.updateChunkStatus(chunkId, enabled),

  testRetrieve: (knowledgeBaseId: string, payload: RetrieveTestPayload) =>
    knowledgeMock.testRetrieve(knowledgeBaseId, payload),
  testRetrieval: (knowledgeBaseId: string, payload: RetrieveTestPayload) =>
    knowledgeMock.testRetrieve(knowledgeBaseId, payload),
  getRetrievalTests: (knowledgeBaseId: string) => knowledgeMock.getRetrievalTests(knowledgeBaseId),

  getMetadataFields: (knowledgeBaseId: string) => knowledgeMock.getMetadataFields(knowledgeBaseId),
  createMetadataField: (knowledgeBaseId: string, payload: CreateMetadataFieldPayload) =>
    knowledgeMock.createMetadataField(knowledgeBaseId, payload),
  updateMetadataField: (fieldId: string, payload: UpdateMetadataFieldPayload) =>
    knowledgeMock.updateMetadataField(fieldId, payload),
  deleteMetadataField: (fieldId: string) => knowledgeMock.deleteMetadataField(fieldId),

  getPipelineTasks: (knowledgeBaseId: string) => knowledgeMock.getPipelineTasks(knowledgeBaseId),
};
