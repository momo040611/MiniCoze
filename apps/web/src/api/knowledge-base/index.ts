import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from '../workspace';
import {
  getFileAssetId,
  mapChunkDtoToViewModel,
  mapKnowledgeBaseDtoToViewModel,
  mapKnowledgeDocumentDtoToViewModel,
  mapParseConfigToChunkConfig,
  mapPreviewChunkToViewModel,
  mapRetrieveResultDtoToViewModel,
  parseChunkViewId,
  type FileAssetDto,
  type KnowledgeBaseDto,
  type KnowledgeChunkConfigDto,
  type KnowledgeChunkDto,
  type KnowledgeChunkPreview,
  type KnowledgeDocumentDto,
  type RetrievalResultDto,
} from './adapters';
import { knowledgeMock } from './mock';
import {
  DocumentStatus,
  KnowledgeStatus,
  RetrievalMode,
  type ApiResponse,
  type ChunkListParams,
  type CreateChunkPayload,
  type CreateKnowledgeBasePayload,
  type CreateMetadataFieldPayload,
  type DocumentListParams,
  type KnowledgeBase,
  type KnowledgeChunk,
  type KnowledgeDocument,
  type KnowledgeRetrievalTest,
  type ListParams,
  type PageResult,
  type ParseConfig,
  type RetrieveTestPayload,
  type RetrievalResult,
  type UpdateChunkPayload,
  type UpdateKnowledgeBaseOrderPayload,
  type UpdateKnowledgeBasePayload,
  type UpdateMetadataFieldPayload,
} from './types';

export * from './adapters';
export * from './types';

type BackendPage<T> = {
  list?: T[];
  items?: T[];
  records?: T[];
  chunks?: T[];
  results?: T[];
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
};

type KnowledgeBaseOverrides = Record<string, Partial<KnowledgeBase>>;

type KnowledgeBaseListParams = ListParams & {
  workspaceId?: string;
};

export type PreviewKnowledgeChunksPayload = {
  fileId: string;
  fileName?: string;
  parseConfig?: ParseConfig;
  chunkConfig?: KnowledgeChunkConfigDto;
};

export type CreateKnowledgeDocumentPayload = {
  fileId: string;
  fileAsset?: FileAssetDto;
  parseConfig?: ParseConfig;
  chunkConfig?: KnowledgeChunkConfigDto;
};

export type RetrieveKnowledgePayload = {
  knowledgeBaseIds: string[];
  query: string;
  topK?: number;
  minScore?: number;
};

const KNOWLEDGE_BASE_OVERRIDES_KEY = 'miniCoze_knowledge_base_overrides_v1';
const RETRIEVAL_HISTORY_KEY = 'miniCoze_knowledge_retrieval_history_v1';

const env = (import.meta as ImportMeta & {
  env?: {
    VITE_USE_KNOWLEDGE_MOCK?: string;
    VITE_KNOWLEDGE_API_MODE?: string;
  };
}).env;

const useKnowledgeMock =
  env?.VITE_USE_KNOWLEDGE_MOCK === 'true' ||
  env?.VITE_KNOWLEDGE_API_MODE === 'mock';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ok<T>(data: T, message = 'success'): ApiResponse<T> {
  return { code: 0, message, data };
}

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (isRecord(payload) && 'data' in payload && ('code' in payload || 'message' in payload)) {
    return payload.data as T;
  }

  return payload as T;
}

function getBackendList<T>(value: T[] | BackendPage<T>): T[] {
  if (Array.isArray(value)) return value;

  return value.list ?? value.items ?? value.records ?? value.chunks ?? value.results ?? value.data ?? [];
}

function toPageResult<T>(list: T[], params?: ListParams, total = list.length): PageResult<T> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? Math.max(list.length, 1);
  const start = (page - 1) * pageSize;
  const shouldPage = Boolean(params?.page || params?.pageSize);
  const pageList = shouldPage ? list.slice(start, start + pageSize) : list;

  return {
    list: pageList,
    total,
    page,
    pageSize,
  };
}

function withKeyword<T>(list: T[], keyword: string | undefined, pickText: (item: T) => string) {
  const normalized = keyword?.trim().toLowerCase();
  if (!normalized) return list;
  return list.filter((item) => pickText(item).toLowerCase().includes(normalized));
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures; the real API remains the source of truth.
  }
}

function readBaseOverrides(): KnowledgeBaseOverrides {
  return readJsonStorage<KnowledgeBaseOverrides>(KNOWLEDGE_BASE_OVERRIDES_KEY, {});
}

function mergeBaseOverride(id: string, patch: Partial<KnowledgeBase>) {
  const overrides = readBaseOverrides();
  overrides[id] = {
    ...(overrides[id] ?? {}),
    ...patch,
  };
  writeJsonStorage(KNOWLEDGE_BASE_OVERRIDES_KEY, overrides);
}

function removeBaseOverride(id: string) {
  const overrides = readBaseOverrides();
  delete overrides[id];
  writeJsonStorage(KNOWLEDGE_BASE_OVERRIDES_KEY, overrides);
}

function pickBaseOverride(payload: Partial<CreateKnowledgeBasePayload & UpdateKnowledgeBasePayload>) {
  const override: Partial<KnowledgeBase> = {};

  if (payload.name !== undefined) override.name = payload.name;
  if (payload.description !== undefined) override.description = payload.description;
  if (payload.icon !== undefined) override.icon = payload.icon;
  if (payload.iconType !== undefined) override.iconType = payload.iconType;
  if (payload.iconImageUrl !== undefined) override.iconImageUrl = payload.iconImageUrl;
  if (payload.sourceType !== undefined) override.sourceType = payload.sourceType;
  if (payload.indexMode !== undefined) override.indexMode = payload.indexMode;
  if (payload.chunkConfig !== undefined) override.chunkConfig = payload.chunkConfig;
  if (payload.embeddingConfig !== undefined) override.embeddingConfig = payload.embeddingConfig;
  if (payload.retrievalConfig !== undefined) override.retrievalConfig = payload.retrievalConfig;

  return override;
}

function createFileAssetDocumentDto(fileAsset: FileAssetDto, fileId: string): KnowledgeDocumentDto {
  return {
    fileId,
    fileName: fileAsset.fileName ?? fileAsset.originalName ?? fileAsset.name,
    fileType: fileAsset.type ?? fileAsset.mimeType,
    fileSize: fileAsset.fileSize ?? fileAsset.size,
    createdAt: fileAsset.createdAt,
    updatedAt: fileAsset.updatedAt ?? fileAsset.createdAt,
  };
}

async function mapBaseWithStats(dto: KnowledgeBaseDto): Promise<KnowledgeBase> {
  const overrides = readBaseOverrides()[dto.id];

  try {
    const documents = await getKnowledgeDocuments(dto.id, { pageSize: 1000 });
    const documentCount = documents.data.total;
    const chunkCount = documents.data.list.reduce((sum, document) => sum + document.chunkCount, 0);

    return mapKnowledgeBaseDtoToViewModel(dto, {
      documentCount,
      chunkCount,
      vectorCount: chunkCount,
      overrides,
    });
  } catch {
    return mapKnowledgeBaseDtoToViewModel(dto, { overrides });
  }
}

function getRetrievalHistory(): KnowledgeRetrievalTest[] {
  return readJsonStorage<KnowledgeRetrievalTest[]>(RETRIEVAL_HISTORY_KEY, []);
}

function saveRetrievalHistory(item: KnowledgeRetrievalTest) {
  const history = getRetrievalHistory().filter((current) => current.id !== item.id);
  history.unshift(item);
  writeJsonStorage(RETRIEVAL_HISTORY_KEY, history.slice(0, 50));
}

function getDocumentChunkRequestBody(payload: UpdateChunkPayload) {
  const body: { content?: string; metadata?: Record<string, string | number | boolean> } = {};

  if (payload.content !== undefined) body.content = payload.content;
  if (payload.metadata !== undefined) body.metadata = payload.metadata;

  return body;
}

async function getMockChunkIdByDocumentIndex(documentId: string, chunkIndex: number) {
  const bases = await knowledgeMock.getKnowledgeBases({ pageSize: 1000 });

  for (const base of bases.data.list) {
    const chunks = await knowledgeMock.getChunks(base.id, { documentId, pageSize: 1000 });
    const chunk = chunks.data.list[chunkIndex];
    if (chunk) return chunk.id;
  }

  return `${documentId}:${chunkIndex}`;
}

async function resolveKnowledgeWorkspaceId(workspaceId?: string) {
  const resolvedWorkspaceId = workspaceId?.trim() || (await getCurrentWorkspaceId()).trim();

  if (!resolvedWorkspaceId) {
    throw new Error('Missing workspaceId for knowledge base list');
  }

  return resolvedWorkspaceId;
}

async function getKnowledgeBases(params?: KnowledgeBaseListParams) {
  if (useKnowledgeMock) {
    return knowledgeMock.getKnowledgeBases(params);
  }

  const workspaceId = await resolveKnowledgeWorkspaceId(params?.workspaceId);
  const response = await http.get<ApiEnvelope<KnowledgeBaseDto[] | BackendPage<KnowledgeBaseDto>>>(
    'knowledge/bases',
    { query: { workspaceId } },
  );
  const payload = unwrap(response);
  const rawList = getBackendList(payload);
  const mapped = await Promise.all(rawList.map((item) => mapBaseWithStats(item)));
  const filtered = withKeyword(mapped, params?.keyword, (item) => `${item.name} ${item.description}`);

  return ok(toPageResult(filtered, params));
}

async function getKnowledgeBaseById(id: string) {
  if (useKnowledgeMock) {
    return knowledgeMock.getKnowledgeBaseById(id);
  }

  const response = await getKnowledgeBases({ pageSize: 1000 });
  return ok(response.data.list.find((item) => item.id === id) ?? null);
}

async function createKnowledgeBase(payload: CreateKnowledgeBasePayload) {
  if (useKnowledgeMock) {
    return knowledgeMock.createKnowledgeBase(payload);
  }

  const workspaceId = await getCurrentWorkspaceId();
  const response = await http.post<ApiEnvelope<KnowledgeBaseDto>, { workspaceId: string; name: string; description: string }>(
    'knowledge/bases',
    {
      workspaceId,
      name: payload.name,
      description: payload.description,
    },
  );
  const dto = unwrap(response);
  mergeBaseOverride(dto.id, pickBaseOverride(payload));

  return ok(await mapBaseWithStats(dto), 'created');
}

async function updateKnowledgeBaseEnabled(id: string, enabled: boolean) {
  if (useKnowledgeMock) {
    return knowledgeMock.updateKnowledgeBase(id, {
      status: enabled ? KnowledgeStatus.Active : KnowledgeStatus.Disabled,
    });
  }

  const response = await http.patch<ApiEnvelope<KnowledgeBaseDto>, { enabled: boolean }>(
    `knowledge/bases/${id}/enabled`,
    { enabled },
  );

  return ok(await mapBaseWithStats(unwrap(response)), 'updated');
}

async function updateKnowledgeBase(id: string, payload: UpdateKnowledgeBasePayload) {
  if (useKnowledgeMock) {
    return knowledgeMock.updateKnowledgeBase(id, payload);
  }

  const override = pickBaseOverride(payload);
  if (Object.keys(override).length > 0) {
    mergeBaseOverride(id, override);
  }

  if (payload.status !== undefined) {
    return updateKnowledgeBaseEnabled(id, payload.status !== KnowledgeStatus.Disabled);
  }

  return getKnowledgeBaseById(id);
}

async function deleteKnowledgeBase(id: string) {
  if (useKnowledgeMock) {
    return knowledgeMock.deleteKnowledgeBase(id);
  }

  await http.delete<ApiEnvelope<unknown>>(`knowledge/bases/${id}`);
  removeBaseOverride(id);
  return ok(true, 'deleted');
}

async function updateKnowledgeBaseOrder(payload: UpdateKnowledgeBaseOrderPayload) {
  if (useKnowledgeMock) {
    return knowledgeMock.updateKnowledgeBaseOrder(payload);
  }

  const response = await getKnowledgeBases({ pageSize: 1000 });
  const order = new Map(payload.ids.map((id, index) => [id, index]));
  const list = [...response.data.list].sort((left, right) => {
    const leftOrder = order.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });

  return ok(list, 'ordered');
}

async function uploadKnowledgeFile(file: File, workspaceId?: string) {
  if (useKnowledgeMock) {
    const createdAt = new Date().toISOString();
    return ok<FileAssetDto>({
      id: `mock-file-${Date.now()}`,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      purpose: 'KNOWLEDGE_DOCUMENT',
      workspaceId: workspaceId ?? await getCurrentWorkspaceId(),
      createdAt,
      updatedAt: createdAt,
    });
  }

  const resolvedWorkspaceId = workspaceId ?? await getCurrentWorkspaceId();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'KNOWLEDGE_DOCUMENT');
  formData.append('workspaceId', resolvedWorkspaceId);

  const response = await http.post<ApiEnvelope<FileAssetDto>, FormData>(
    'files/upload',
    formData,
    { timeout: 60000 },
  );

  return ok(unwrap(response), 'uploaded');
}

async function previewKnowledgeChunks(payload: PreviewKnowledgeChunksPayload) {
  if (useKnowledgeMock) {
    return ok<KnowledgeChunkPreview[]>([
      mapPreviewChunkToViewModel(
        {
          content: payload.fileName
            ? `${payload.fileName} preview chunk`
            : 'Preview chunk',
        },
        0,
      ),
    ]);
  }

  const chunkConfig = payload.chunkConfig ?? mapParseConfigToChunkConfig(payload.parseConfig);
  const response = await http.post<ApiEnvelope<unknown[] | BackendPage<unknown>>, { fileId: string; chunkConfig: KnowledgeChunkConfigDto }>(
    'knowledge/chunk',
    {
      fileId: payload.fileId,
      chunkConfig,
    },
    { timeout: 60000 },
  );
  const data = unwrap(response);
  const chunks = getBackendList(data);

  return ok(chunks.map(mapPreviewChunkToViewModel));
}

async function createKnowledgeDocument(knowledgeBaseId: string, payload: CreateKnowledgeDocumentPayload) {
  if (useKnowledgeMock) {
    const now = new Date().toISOString();
    return ok<KnowledgeDocument>({
      id: `mock-doc-${Date.now()}`,
      knowledgeBaseId,
      fileName: payload.fileAsset?.fileName ?? payload.fileAsset?.name ?? payload.fileId,
      fileType: payload.fileAsset?.type ?? payload.fileAsset?.mimeType ?? 'txt',
      fileSize: payload.fileAsset?.fileSize ?? payload.fileAsset?.size ?? 0,
      status: DocumentStatus.Completed,
      chunkCount: 0,
      parseConfig: payload.parseConfig,
      uploadProgress: 100,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  const chunkConfig = payload.chunkConfig ?? mapParseConfigToChunkConfig(payload.parseConfig);
  const response = await http.post<ApiEnvelope<KnowledgeDocumentDto>, { fileId: string; chunkConfig: KnowledgeChunkConfigDto }>(
    `knowledge/bases/${knowledgeBaseId}/documents`,
    {
      fileId: payload.fileId,
      chunkConfig,
    },
    { timeout: 60000 },
  );
  const documentDto = {
    ...(payload.fileAsset ? createFileAssetDocumentDto(payload.fileAsset, payload.fileId) : {}),
    ...unwrap(response),
  };

  return ok(mapKnowledgeDocumentDtoToViewModel(documentDto, knowledgeBaseId, payload.parseConfig), 'created');
}

async function uploadDocument(knowledgeBaseId: string, file: File, parseConfig?: ParseConfig) {
  if (useKnowledgeMock) {
    return knowledgeMock.uploadDocument(knowledgeBaseId, file, parseConfig);
  }

  const fileResponse = await uploadKnowledgeFile(file);
  const fileAsset = fileResponse.data;
  const fileId = getFileAssetId(fileAsset);

  await previewKnowledgeChunks({
    fileId,
    fileName: file.name,
    parseConfig,
  });

  return createKnowledgeDocument(knowledgeBaseId, {
    fileId,
    fileAsset: {
      ...fileAsset,
      fileName: fileAsset.fileName ?? file.name,
      fileSize: fileAsset.fileSize ?? file.size,
      mimeType: fileAsset.mimeType ?? file.type,
    },
    parseConfig,
  });
}

async function getKnowledgeDocuments(knowledgeBaseId: string, params?: DocumentListParams) {
  if (useKnowledgeMock) {
    return knowledgeMock.getDocuments(knowledgeBaseId, params);
  }

  const response = await http.get<ApiEnvelope<KnowledgeDocumentDto[] | BackendPage<KnowledgeDocumentDto>>>(
    `knowledge/bases/${knowledgeBaseId}/documents`,
    { query: { page: params?.page, pageSize: params?.pageSize } },
  );
  const payload = unwrap(response);
  const rawList = getBackendList(payload);
  const mapped = rawList.map((item) => mapKnowledgeDocumentDtoToViewModel(item, knowledgeBaseId));
  const filteredByKeyword = withKeyword(mapped, params?.keyword, (item) => item.fileName);
  const filtered = filteredByKeyword.filter((item) => {
    const matchesStatus = !params?.status || item.status === params.status;
    const matchesEnabled = params?.enabled === undefined || item.enabled === params.enabled;
    return matchesStatus && matchesEnabled;
  });

  return ok(toPageResult(filtered, params));
}

async function deleteKnowledgeDocument(documentId: string) {
  if (useKnowledgeMock) {
    return knowledgeMock.deleteDocument(documentId);
  }

  await http.delete<ApiEnvelope<unknown>>(`knowledge/documents/${documentId}`);
  return ok(true, 'deleted');
}

async function getDocumentChunks(documentId: string, params?: ChunkListParams & { knowledgeBaseId?: string; documentName?: string }) {
  if (useKnowledgeMock) {
    if (params?.knowledgeBaseId) {
      return knowledgeMock.getChunks(params.knowledgeBaseId, { ...params, documentId });
    }

    const bases = await knowledgeMock.getKnowledgeBases({ pageSize: 1000 });
    const pages = await Promise.all(
      bases.data.list.map((base) => knowledgeMock.getChunks(base.id, { ...params, documentId, pageSize: 1000 })),
    );
    const chunks = pages.flatMap((page) => page.data.list);
    return ok(toPageResult(chunks, params));
  }

  const response = await http.get<ApiEnvelope<KnowledgeChunkDto[] | BackendPage<KnowledgeChunkDto>>>(
    `knowledge/documents/${documentId}/chunks/page`,
    { query: { page: params?.page, pageSize: params?.pageSize } },
  );
  const payload = unwrap(response);
  const rawList = getBackendList(payload);
  const mapped = rawList.map((item, index) =>
    mapChunkDtoToViewModel(item, {
      knowledgeBaseId: params?.knowledgeBaseId,
      documentId,
      documentName: params?.documentName,
      index,
    }),
  );
  const filteredByKeyword = withKeyword(mapped, params?.keyword, (item) => item.content);
  const filtered = filteredByKeyword.filter((item) => params?.enabled === undefined || item.enabled === params.enabled);

  return ok(toPageResult(filtered, params));
}

async function getChunks(knowledgeBaseId: string, params?: ChunkListParams) {
  if (useKnowledgeMock) {
    return knowledgeMock.getChunks(knowledgeBaseId, params);
  }

  if (params?.documentId && params.documentId !== 'all') {
    const documentResponse = await getKnowledgeDocuments(knowledgeBaseId, { pageSize: 1000 });
    const document = documentResponse.data.list.find((item) => item.id === params.documentId);
    return getDocumentChunks(params.documentId, {
      ...params,
      knowledgeBaseId,
      documentName: document?.fileName,
    });
  }

  const documentResponse = await getKnowledgeDocuments(knowledgeBaseId, { pageSize: 1000 });
  const chunkPages = await Promise.all(
    documentResponse.data.list.map((document) =>
      getDocumentChunks(document.id, {
        pageSize: params?.pageSize ?? 1000,
        knowledgeBaseId,
        documentName: document.fileName,
      }),
    ),
  );
  const allChunks = chunkPages.flatMap((page) => page.data.list);
  const filteredByKeyword = withKeyword(allChunks, params?.keyword, (item) => item.content);
  const filtered = filteredByKeyword.filter((item) => params?.enabled === undefined || item.enabled === params.enabled);

  return ok(toPageResult(filtered, params));
}

async function updateDocumentChunk(documentId: string, chunkIndex: number, payload: UpdateChunkPayload) {
  if (useKnowledgeMock) {
    return knowledgeMock.updateChunk(await getMockChunkIdByDocumentIndex(documentId, chunkIndex), payload);
  }

  const response = await http.put<ApiEnvelope<KnowledgeChunkDto | null>, ReturnType<typeof getDocumentChunkRequestBody>>(
    `knowledge/documents/${documentId}/chunks/${chunkIndex}`,
    getDocumentChunkRequestBody(payload),
  );
  const dto = unwrap(response);

  return ok(dto ? mapChunkDtoToViewModel(dto, { documentId, index: chunkIndex }) : null, 'updated');
}

async function updateChunk(chunkId: string, payload: UpdateChunkPayload) {
  if (useKnowledgeMock) {
    return knowledgeMock.updateChunk(chunkId, payload);
  }

  const target = parseChunkViewId(chunkId);
  if (!target) {
    throw new Error('Invalid chunk id for real knowledge API');
  }

  return updateDocumentChunk(target.documentId, target.chunkIndex, payload);
}

async function deleteDocumentChunk(documentId: string, chunkIndex: number) {
  if (useKnowledgeMock) {
    return knowledgeMock.deleteChunk(await getMockChunkIdByDocumentIndex(documentId, chunkIndex));
  }

  await http.delete<ApiEnvelope<unknown>>(`knowledge/documents/${documentId}/chunks/${chunkIndex}`);
  return ok(true, 'deleted');
}

async function deleteChunk(chunkId: string) {
  if (useKnowledgeMock) {
    return knowledgeMock.deleteChunk(chunkId);
  }

  const target = parseChunkViewId(chunkId);
  if (!target) {
    throw new Error('Invalid chunk id for real knowledge API');
  }

  return deleteDocumentChunk(target.documentId, target.chunkIndex);
}

async function updateDocumentChunkEnabled(documentId: string, chunkIndex: number, enabled: boolean) {
  if (useKnowledgeMock) {
    return knowledgeMock.updateChunkStatus(await getMockChunkIdByDocumentIndex(documentId, chunkIndex), enabled);
  }

  const response = await http.patch<ApiEnvelope<KnowledgeChunkDto | null>, { enabled: boolean }>(
    `knowledge/documents/${documentId}/chunks/${chunkIndex}/enabled`,
    { enabled },
  );
  const dto = unwrap(response);

  return ok(dto ? mapChunkDtoToViewModel(dto, { documentId, index: chunkIndex }) : null, 'updated');
}

async function updateChunkStatus(chunkId: string, enabled: boolean) {
  if (useKnowledgeMock) {
    return knowledgeMock.updateChunkStatus(chunkId, enabled);
  }

  const target = parseChunkViewId(chunkId);
  if (!target) {
    throw new Error('Invalid chunk id for real knowledge API');
  }

  return updateDocumentChunkEnabled(target.documentId, target.chunkIndex, enabled);
}

async function retrieveKnowledge(payload: RetrieveKnowledgePayload) {
  if (useKnowledgeMock) {
    return knowledgeMock.testRetrieve(payload.knowledgeBaseIds[0] ?? '', {
      query: payload.query,
      retrievalMode: RetrievalMode.Vector,
      topK: payload.topK ?? 5,
      scoreThreshold: payload.minScore ?? 0.35,
      rerankEnabled: false,
    });
  }

  const response = await http.post<ApiEnvelope<RetrievalResultDto[] | BackendPage<RetrievalResultDto>>, RetrieveKnowledgePayload>(
    'knowledge/retrieval',
    {
      knowledgeBaseIds: payload.knowledgeBaseIds,
      query: payload.query,
      topK: payload.topK ?? 5,
      minScore: payload.minScore ?? 0.35,
    },
    { timeout: 60000 },
  );
  const data = unwrap(response);
  const results = getBackendList(data).map(mapRetrieveResultDtoToViewModel);

  return ok(results);
}

async function testRetrieve(knowledgeBaseId: string, payload: RetrieveTestPayload) {
  if (useKnowledgeMock) {
    return knowledgeMock.testRetrieve(knowledgeBaseId, payload);
  }

  const startedAt = performance.now();
  const response = await retrieveKnowledge({
    knowledgeBaseIds: [knowledgeBaseId],
    query: payload.query,
    topK: payload.topK,
    minScore: payload.scoreThreshold,
  });
  const createdAt = new Date().toISOString();
  const history: KnowledgeRetrievalTest = {
    id: `rtest-${Date.now()}`,
    knowledgeBaseId,
    query: payload.query,
    retrievalMode: payload.retrievalMode,
    topK: payload.topK,
    scoreThreshold: payload.scoreThreshold,
    rerankEnabled: payload.rerankEnabled,
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    resultCount: response.data.length,
    createdAt,
    results: response.data,
  };

  saveRetrievalHistory(history);

  return response;
}

async function getRetrievalTests(knowledgeBaseId: string) {
  if (useKnowledgeMock) {
    return knowledgeMock.getRetrievalTests(knowledgeBaseId);
  }

  return ok(getRetrievalHistory().filter((item) => item.knowledgeBaseId === knowledgeBaseId));
}

async function reindexKnowledgeBase(id: string, force = false) {
  if (useKnowledgeMock) {
    return ok({ id, force, status: 'submitted' });
  }

  const response = await http.post<ApiEnvelope<unknown>>(
    `knowledge/bases/${id}/reindex`,
    undefined,
    { query: { force } },
  );

  return ok(unwrap(response));
}

export const knowledgeApi = {
  getKnowledgeBases,
  getKnowledgeBaseById,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  updateKnowledgeBaseEnabled,
  updateKnowledgeBaseOrder,
  updateKnowledgeSettings: updateKnowledgeBase,

  uploadKnowledgeFile,
  previewKnowledgeChunks,
  createKnowledgeDocument,
  uploadDocument,

  getKnowledgeDocuments,
  getDocuments: getKnowledgeDocuments,
  deleteKnowledgeDocument,
  deleteDocument: deleteKnowledgeDocument,
  reparseDocument: knowledgeMock.reparseDocument,
  retryDocument: knowledgeMock.retryDocument,
  cancelUpload: knowledgeMock.cancelUpload,
  getUploadTasks: knowledgeMock.getUploadTasks,
  updateDocumentStatus: knowledgeMock.updateDocumentStatus,

  getDocumentChunks,
  getChunks,
  createChunk: knowledgeMock.createChunk,
  updateDocumentChunk,
  updateChunk,
  deleteDocumentChunk,
  deleteChunk,
  updateDocumentChunkEnabled,
  updateChunkStatus,

  retrieveKnowledge,
  testRetrieve,
  testRetrieval: testRetrieve,
  getRetrievalTests,
  reindexKnowledgeBase,

  getMetadataFields: knowledgeMock.getMetadataFields,
  createMetadataField: (knowledgeBaseId: string, payload: CreateMetadataFieldPayload) =>
    knowledgeMock.createMetadataField(knowledgeBaseId, payload),
  updateMetadataField: (fieldId: string, payload: UpdateMetadataFieldPayload) =>
    knowledgeMock.updateMetadataField(fieldId, payload),
  deleteMetadataField: knowledgeMock.deleteMetadataField,

  getPipelineTasks: knowledgeMock.getPipelineTasks,
};
