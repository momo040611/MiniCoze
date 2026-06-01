import {
  ChunkMode,
  DocumentStatus,
  IndexMode,
  KnowledgeStatus,
  MetadataFieldType,
  RetrievalMode,
  type ApiResponse,
  type CreateChunkPayload,
  type CreateKnowledgeBasePayload,
  type CreateMetadataFieldPayload,
  type ChunkListParams,
  type DocumentListParams,
  type KnowledgeBase,
  type KnowledgeChunk,
  type KnowledgeDocument,
  type MetadataField,
  type PageResult,
  type ParseConfig,
  type PipelineTask,
  type RetrieveTestPayload,
  type RetrievalResult,
  type KnowledgeRetrievalTest,
  type UploadDocumentTask,
  type UpdateChunkPayload,
  type UpdateKnowledgeBasePayload,
  type UpdateKnowledgeBaseOrderPayload,
  type UpdateMetadataFieldPayload,
} from './types';

type KnowledgeStore = {
  bases: KnowledgeBase[];
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
  metadataFields: MetadataField[];
  pipelineTasks: PipelineTask[];
  uploadTasks: UploadDocumentTask[];
  retrievalTests: KnowledgeRetrievalTest[];
};

const STORAGE_KEY = 'miniCoze_mock_knowledge_store_v1';

function now() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { code: 0, message, data };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wait(duration = 450) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

const defaultParseConfig: ParseConfig = {
  ocrEnabled: true,
  preserveTable: true,
  extractImageCaption: false,
  chunkMode: ChunkMode.General,
  chunkSize: 800,
  chunkOverlap: 100,
  autoVectorize: true,
};

function normalizeStore(store: KnowledgeStore): KnowledgeStore {
  store.uploadTasks ??= [];
  store.retrievalTests ??= [];
  store.bases.forEach((base) => {
    base.vectorCount ??= base.chunkCount;
    base.indexStatus ??= base.chunkCount > 0 ? 'ready' : 'not_started';
    base.tags ??= [];
    base.owner ??= 'MiniCoze';
  });
  store.documents.forEach((document) => {
    document.parserVersion ??= 'pipeline-v1';
    document.lastParsedAt ??= document.updatedAt;
    document.uploadProgress ??= document.status === DocumentStatus.Completed ? 100 : 0;
    document.parseConfig ??= defaultParseConfig;
  });
  store.chunks.forEach((chunk) => {
    chunk.embeddingStatus ??= 'embedded';
    chunk.hitCount ??= 0;
  });
  store.metadataFields.forEach((field) => {
    field.source ??= 'custom';
    field.tags ??= [];
    field.updatedAt ??= now();
    field.required ??= false;
    field.filterable ??= true;
    field.displayInResult ??= true;
  });
  return store;
}

function createSeedStore(): KnowledgeStore {
  const createdAt = now();
  const baseId = 'kb-product';
  const docId = 'doc-product-guide';
  const chunks: KnowledgeChunk[] = [
    {
      id: 'chunk-product-1',
      knowledgeBaseId: baseId,
      documentId: docId,
      documentName: '产品使用手册.pdf',
      content: 'MiniCoze 支持通过知识库为 Agent 提供企业资料、产品文档和客服问答能力。',
      tokenCount: 42,
      characterCount: 38,
      metadata: { category: '产品', language: 'zh-CN', source: 'manual' },
      enabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'chunk-product-2',
      knowledgeBaseId: baseId,
      documentId: docId,
      documentName: '产品使用手册.pdf',
      content: '检索配置支持向量检索、全文检索和混合检索，可通过 Top K 与分数阈值控制召回范围。',
      tokenCount: 58,
      characterCount: 47,
      metadata: { category: '检索', language: 'zh-CN', source: 'manual' },
      enabled: true,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  return {
    bases: [
      {
        id: baseId,
        name: '产品知识库',
        description: '用于产品问答、客服回复和功能说明的示例知识库。',
        icon: '📘',
        iconType: 'emoji',
        status: KnowledgeStatus.Active,
        sourceType: 'local_file',
        documentCount: 1,
        chunkCount: chunks.length,
        vectorCount: chunks.length,
        indexStatus: 'ready',
        tags: ['product', 'support'],
        owner: 'MiniCoze',
        indexMode: IndexMode.HighQuality,
        chunkConfig: {
          chunkMode: ChunkMode.ParentChild,
          chunkSize: 800,
          chunkOverlap: 100,
          separator: '\\n\\n',
          autoClean: true,
        },
        embeddingConfig: {
          embeddingModel: 'text-embedding-3-large',
          embeddingDimension: 3072,
          language: 'zh-CN',
        },
        retrievalConfig: {
          retrievalMode: RetrievalMode.Hybrid,
          topK: 5,
          scoreThreshold: 0.35,
          rerankEnabled: true,
        },
        createdAt,
        updatedAt: createdAt,
      },
    ],
    documents: [
      {
        id: docId,
        knowledgeBaseId: baseId,
        fileName: '产品使用手册.pdf',
        fileType: 'pdf',
        fileSize: 1024 * 860,
        status: DocumentStatus.Completed,
        chunkCount: chunks.length,
        parserVersion: 'pipeline-v1',
        lastParsedAt: createdAt,
        enabled: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    chunks,
    metadataFields: [
      {
        id: 'meta-category',
        knowledgeBaseId: baseId,
        name: 'category',
        type: MetadataFieldType.Select,
        description: '内容分类',
        enabled: true,
      },
      {
        id: 'meta-language',
        knowledgeBaseId: baseId,
        name: 'language',
        type: MetadataFieldType.String,
        description: '文档语言',
        enabled: true,
      },
    ],
    pipelineTasks: [],
    uploadTasks: [],
    retrievalTests: [],
  };
}

function readStore(): KnowledgeStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedStore();
    return normalizeStore(JSON.parse(raw) as KnowledgeStore);
  } catch {
    return createSeedStore();
  }
}

function writeStore(store: KnowledgeStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function refreshBaseStats(store: KnowledgeStore, knowledgeBaseId: string) {
  const base = store.bases.find((item) => item.id === knowledgeBaseId);
  if (!base) return;
  base.documentCount = store.documents.filter((doc) => doc.knowledgeBaseId === knowledgeBaseId).length;
  base.chunkCount = store.chunks.filter((chunk) => chunk.knowledgeBaseId === knowledgeBaseId).length;
  base.vectorCount = store.chunks.filter((chunk) => chunk.knowledgeBaseId === knowledgeBaseId && chunk.embeddingStatus !== 'failed').length;
  base.indexStatus = base.chunkCount > 0 ? 'ready' : 'not_started';
  base.updatedAt = now();
}

function createPipelineTasks(knowledgeBaseId: string, documentId?: string): PipelineTask[] {
  const startedAt = now();
  return [
    ['upload', '文件上传完成'],
    ['clean', '文本清洗完成'],
    ['chunk', '分段生成完成'],
    ['embedding', 'Embedding 向量化完成'],
    ['vector_store', '写入向量库完成'],
  ].map(([step, message]) => ({
    id: uid('pipe'),
    knowledgeBaseId,
    documentId,
    step: step as PipelineTask['step'],
    status: 'success',
    message,
    startedAt,
    endedAt: now(),
  }));
}

function makeDocumentChunks(baseId: string, document: KnowledgeDocument) {
  const count = 3 + Math.floor(Math.random() * 3);
  return Array.from({ length: count }, (_, index): KnowledgeChunk => {
    const content = `${document.fileName} 自动解析片段 ${index + 1}。该片段包含企业知识、业务规则和 Agent 可检索的上下文。`;
    return {
      id: uid('chunk'),
      knowledgeBaseId: baseId,
      documentId: document.id,
      documentName: document.fileName,
      content,
      tokenCount: 80 + index * 12,
      characterCount: content.length,
      embeddingStatus: 'embedded',
      hitCount: 8 + index * 3,
      metadata: {
        fileType: document.fileType,
        section: `section-${index + 1}`,
        source: 'upload',
      },
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
    };
  });
}

export const knowledgeMock = {
  async getKnowledgeBases(params?: { keyword?: string; page?: number; pageSize?: number }) {
    const store = readStore();
    const keyword = params?.keyword?.trim().toLowerCase();
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 50;
    const filtered = keyword
      ? store.bases.filter((item) => item.name.toLowerCase().includes(keyword))
      : store.bases;
    const start = (page - 1) * pageSize;
    return ok<PageResult<KnowledgeBase>>({
      list: clone(filtered.slice(start, start + pageSize)),
      total: filtered.length,
      page,
      pageSize,
    });
  },

  async getKnowledgeBaseById(id: string) {
    const base = readStore().bases.find((item) => item.id === id) ?? null;
    return ok<KnowledgeBase | null>(clone(base));
  },

  async createKnowledgeBase(payload: CreateKnowledgeBasePayload) {
    const store = readStore();
    const createdAt = now();
      const base: KnowledgeBase = {
        id: uid('kb'),
        ...payload,
        icon: payload.icon ?? '📘',
        iconType: payload.iconImageUrl ? 'image' : (payload.iconType ?? 'emoji'),
      status: KnowledgeStatus.Active,
      vectorCount: 0,
      indexStatus: 'not_started',
      tags: [],
      owner: 'MiniCoze',
      documentCount: 0,
      chunkCount: 0,
      createdAt,
      updatedAt: createdAt,
    };
    store.bases.unshift(base);
    writeStore(store);
    return ok(clone(base), 'created');
  },

  async updateKnowledgeBase(id: string, payload: UpdateKnowledgeBasePayload) {
    const store = readStore();
    const base = store.bases.find((item) => item.id === id);
    if (!base) return ok<KnowledgeBase | null>(null, 'not found');
    Object.assign(base, payload, { updatedAt: now() });
    writeStore(store);
    return ok(clone(base), 'updated');
  },

  async updateKnowledgeBaseOrder(payload: UpdateKnowledgeBaseOrderPayload) {
    const store = readStore();
    const order = new Map(payload.ids.map((id, index) => [id, index]));
    store.bases.sort((a, b) => {
      const left = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const right = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    });
    writeStore(store);
    return ok(clone(store.bases), 'ordered');
  },

  async deleteKnowledgeBase(id: string) {
    const store = readStore();
    store.bases = store.bases.filter((item) => item.id !== id);
    store.documents = store.documents.filter((item) => item.knowledgeBaseId !== id);
    store.chunks = store.chunks.filter((item) => item.knowledgeBaseId !== id);
    store.metadataFields = store.metadataFields.filter((item) => item.knowledgeBaseId !== id);
    store.pipelineTasks = store.pipelineTasks.filter((item) => item.knowledgeBaseId !== id);
    writeStore(store);
    return ok(true, 'deleted');
  },

  async getDocuments(knowledgeBaseId: string, params?: DocumentListParams) {
    const keyword = params?.keyword?.trim().toLowerCase();
    const list = readStore().documents.filter((item) => {
      const matchesBase = item.knowledgeBaseId === knowledgeBaseId;
      const matchesKeyword = !keyword || item.fileName.toLowerCase().includes(keyword);
      const matchesStatus = !params?.status || item.status === params.status;
      const matchesEnabled = params?.enabled === undefined || item.enabled === params.enabled;
      return matchesBase && matchesKeyword && matchesStatus && matchesEnabled;
    });
    return ok<PageResult<KnowledgeDocument>>({ list: clone(list), total: list.length, page: 1, pageSize: 100 });
  },

  async uploadDocument(knowledgeBaseId: string, file: File, parseConfig: ParseConfig = defaultParseConfig) {
    const store = readStore();
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
    const task: UploadDocumentTask = {
      id: uid('upload'),
      knowledgeBaseId,
      fileName: file.name,
      fileType: extension,
      fileSize: file.size,
      status: 'uploading',
      progress: 35,
      parseConfig,
      createdAt: now(),
      updatedAt: now(),
    };
    const document: KnowledgeDocument = {
      id: uid('doc'),
      knowledgeBaseId,
      fileName: file.name,
      fileType: extension,
      fileSize: file.size,
      status: DocumentStatus.Completed,
      chunkCount: 0,
      parserVersion: 'pipeline-v1',
      lastParsedAt: now(),
      parseConfig,
      uploadProgress: 100,
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
    };
    if (file.name.toLowerCase().includes('fail')) {
      task.status = 'failed';
      task.progress = 100;
      task.errorMessage = '模拟上传失败：文件名包含 fail';
      document.status = DocumentStatus.Failed;
      document.errorMessage = task.errorMessage;
      document.chunkCount = 0;
      store.uploadTasks.unshift(task);
      store.documents.unshift(document);
      refreshBaseStats(store, knowledgeBaseId);
      writeStore(store);
      return ok(clone(document), 'failed');
    }
    const chunks = makeDocumentChunks(knowledgeBaseId, document);
    document.chunkCount = chunks.length;
    task.status = 'completed';
    task.progress = 100;
    task.documentId = document.id;
    store.documents.unshift(document);
    store.chunks.unshift(...chunks);
    store.uploadTasks.unshift(task);
    store.pipelineTasks.unshift(...createPipelineTasks(knowledgeBaseId, document.id));
    refreshBaseStats(store, knowledgeBaseId);
    writeStore(store);
    return ok(clone(document), 'uploaded');
  },

  async retryDocument(documentId: string) {
    return this.reparseDocument(documentId);
  },

  async cancelUpload(taskId: string) {
    const store = readStore();
    const task = store.uploadTasks.find((item) => item.id === taskId);
    if (!task) return ok<UploadDocumentTask | null>(null, 'not found');
    task.status = 'canceled';
    task.progress = 0;
    task.updatedAt = now();
    writeStore(store);
    return ok(clone(task), 'canceled');
  },

  async getUploadTasks(knowledgeBaseId?: string) {
    const tasks = readStore().uploadTasks.filter((item) => !knowledgeBaseId || item.knowledgeBaseId === knowledgeBaseId);
    return ok(clone(tasks));
  },

  async deleteDocument(documentId: string) {
    const store = readStore();
    const document = store.documents.find((item) => item.id === documentId);
    store.documents = store.documents.filter((item) => item.id !== documentId);
    store.chunks = store.chunks.filter((item) => item.documentId !== documentId);
    if (document) refreshBaseStats(store, document.knowledgeBaseId);
    writeStore(store);
    return ok(true, 'deleted');
  },

  async reparseDocument(documentId: string) {
    const store = readStore();
    const document = store.documents.find((item) => item.id === documentId);
    if (!document) return ok<KnowledgeDocument | null>(null, 'not found');
    document.status = DocumentStatus.Parsing;
    document.updatedAt = now();
    store.pipelineTasks.unshift(
      {
        id: uid('pipe'),
        knowledgeBaseId: document.knowledgeBaseId,
        documentId: document.id,
        step: 'clean',
        status: 'processing',
        message: '正在重新清洗文档内容',
        startedAt: now(),
      },
      {
        id: uid('pipe'),
        knowledgeBaseId: document.knowledgeBaseId,
        documentId: document.id,
        step: 'chunk',
        status: 'pending',
        message: '等待重新分段',
        startedAt: now(),
      },
    );
    writeStore(store);
    await wait();
    store.chunks = store.chunks.filter((item) => item.documentId !== documentId);
    const chunks = makeDocumentChunks(document.knowledgeBaseId, document);
    document.status = DocumentStatus.Completed;
    document.chunkCount = chunks.length;
    document.updatedAt = now();
    store.chunks.unshift(...chunks);
    store.pipelineTasks.unshift(...createPipelineTasks(document.knowledgeBaseId, document.id));
    refreshBaseStats(store, document.knowledgeBaseId);
    writeStore(store);
    return ok(clone(document), 'reparsed');
  },

  async updateDocumentStatus(documentId: string, enabled: boolean) {
    const store = readStore();
    const document = store.documents.find((item) => item.id === documentId);
    if (!document) return ok<KnowledgeDocument | null>(null, 'not found');
    document.enabled = enabled;
    document.updatedAt = now();
    writeStore(store);
    return ok(clone(document), 'updated');
  },

  async getChunks(knowledgeBaseId: string, params?: ChunkListParams) {
    const keyword = params?.keyword?.trim().toLowerCase();
    const list = readStore().chunks.filter((item) => {
      const matchesBase = item.knowledgeBaseId === knowledgeBaseId;
      const matchesKeyword = !keyword || item.content.toLowerCase().includes(keyword);
      const matchesDocument = !params?.documentId || params.documentId === 'all' || item.documentId === params.documentId;
      const matchesEnabled = params?.enabled === undefined || item.enabled === params.enabled;
      return matchesBase && matchesKeyword && matchesDocument && matchesEnabled;
    });
    return ok<PageResult<KnowledgeChunk>>({ list: clone(list), total: list.length, page: 1, pageSize: 1000 });
  },

  async createChunk(knowledgeBaseId: string, payload: CreateChunkPayload) {
    const store = readStore();
    const documentId = payload.documentId ?? `manual-${knowledgeBaseId}`;
    const documentName = payload.documentName ?? '手动新增';
    const chunk: KnowledgeChunk = {
      id: uid('chunk'),
      knowledgeBaseId,
      documentId,
      documentName,
      content: payload.content,
      tokenCount: Math.ceil(payload.content.length / 2),
      characterCount: payload.content.length,
      metadata: payload.metadata,
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
    };
    store.chunks.unshift(chunk);
    refreshBaseStats(store, knowledgeBaseId);
    writeStore(store);
    return ok(clone(chunk), 'created');
  },

  async updateChunk(chunkId: string, payload: UpdateChunkPayload) {
    const store = readStore();
    const chunk = store.chunks.find((item) => item.id === chunkId);
    if (!chunk) return ok<KnowledgeChunk | null>(null, 'not found');
    Object.assign(chunk, payload, {
      tokenCount: payload.content ? Math.ceil(payload.content.length / 2) : chunk.tokenCount,
      characterCount: payload.content ? payload.content.length : chunk.characterCount,
      updatedAt: now(),
    });
    writeStore(store);
    return ok(clone(chunk), 'updated');
  },

  async deleteChunk(chunkId: string) {
    const store = readStore();
    const chunk = store.chunks.find((item) => item.id === chunkId);
    store.chunks = store.chunks.filter((item) => item.id !== chunkId);
    if (chunk) refreshBaseStats(store, chunk.knowledgeBaseId);
    writeStore(store);
    return ok(true, 'deleted');
  },

  async updateChunkStatus(chunkId: string, enabled: boolean) {
    return this.updateChunk(chunkId, { enabled });
  },

  async testRetrieve(knowledgeBaseId: string, payload: RetrieveTestPayload) {
    const store = readStore();
    const filter = payload.metadataFilter;
    const chunks = store.chunks.filter((chunk) => {
      if (chunk.knowledgeBaseId !== knowledgeBaseId || !chunk.enabled) return false;
      if (!filter) return true;
      return Object.entries(filter).every(([key, value]) => chunk.metadata[key] === value);
    });
    const scored = chunks
      .map((chunk) => ({
        chunk,
        score: Number((payload.scoreThreshold + Math.random() * (1 - payload.scoreThreshold)).toFixed(3)),
      }))
      .filter((item) => item.score >= payload.scoreThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, payload.topK);

    const results: RetrievalResult[] = scored.map((item, index) => ({
        rank: index + 1,
        score: item.score,
        documentName: item.chunk.documentName,
        chunkContent: item.chunk.content,
        tokenCount: item.chunk.tokenCount,
        vectorDistance: Number((1 - item.score).toFixed(3)),
        rerankScore: payload.rerankEnabled ? Number((item.score + Math.random() * 0.08).toFixed(3)) : undefined,
        matchedBy: payload.rerankEnabled ? ['vector', 'full_text', 'rerank'] : ['vector', 'full_text'],
        metadata: clone(item.chunk.metadata),
      }));
    const history: KnowledgeRetrievalTest = {
      id: uid('rtest'),
      knowledgeBaseId,
      query: payload.query,
      retrievalMode: payload.retrievalMode,
      topK: payload.topK,
      scoreThreshold: payload.scoreThreshold,
      rerankEnabled: payload.rerankEnabled,
      latencyMs: 120 + Math.floor(Math.random() * 380),
      resultCount: results.length,
      createdAt: now(),
      results: clone(results),
    };
    store.retrievalTests.unshift(history);
    writeStore(store);
    return ok<RetrievalResult[]>(results);
  },

  async getRetrievalTests(knowledgeBaseId: string) {
    const tests = readStore().retrievalTests.filter((item) => item.knowledgeBaseId === knowledgeBaseId);
    return ok(clone(tests));
  },

  async getMetadataFields(knowledgeBaseId: string) {
    const list = readStore().metadataFields.filter((item) => item.knowledgeBaseId === knowledgeBaseId);
    return ok(clone(list));
  },

  async createMetadataField(knowledgeBaseId: string, payload: CreateMetadataFieldPayload) {
    const store = readStore();
    const field: MetadataField = {
      id: uid('meta'),
      knowledgeBaseId,
      source: 'custom',
      tags: [],
      updatedAt: now(),
      required: false,
      filterable: true,
      displayInResult: true,
      ...payload,
    };
    store.metadataFields.unshift(field);
    writeStore(store);
    return ok(clone(field), 'created');
  },

  async updateMetadataField(fieldId: string, payload: UpdateMetadataFieldPayload) {
    const store = readStore();
    const field = store.metadataFields.find((item) => item.id === fieldId);
    if (!field) return ok<MetadataField | null>(null, 'not found');
    Object.assign(field, payload, { updatedAt: now() });
    writeStore(store);
    return ok(clone(field), 'updated');
  },

  async deleteMetadataField(fieldId: string) {
    const store = readStore();
    store.metadataFields = store.metadataFields.filter((item) => item.id !== fieldId);
    writeStore(store);
    return ok(true, 'deleted');
  },

  async getPipelineTasks(knowledgeBaseId: string) {
    const tasks = readStore().pipelineTasks.filter((item) => item.knowledgeBaseId === knowledgeBaseId);
    return ok(clone(tasks));
  },
};
