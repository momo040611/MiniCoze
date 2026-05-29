export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

export type PageResult<T> = {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListParams = {
  keyword?: string;
  page?: number;
  pageSize?: number;
};

export type DocumentListParams = ListParams & {
  status?: DocumentStatus;
  enabled?: boolean;
};

export type ChunkListParams = ListParams & {
  documentId?: string;
  enabled?: boolean;
};

export enum KnowledgeStatus {
  Active = 'active',
  Indexing = 'indexing',
  Disabled = 'disabled',
  Failed = 'failed',
}

export enum DocumentStatus {
  Pending = 'pending',
  Uploading = 'uploading',
  Parsing = 'parsing',
  Completed = 'completed',
  Failed = 'failed',
  Canceled = 'canceled',
}

export enum RetrievalMode {
  Vector = 'vector',
  FullText = 'full_text',
  Hybrid = 'hybrid',
}

export enum ChunkMode {
  General = 'general',
  ParentChild = 'parent_child',
  QA = 'qa',
}

export enum IndexMode {
  HighQuality = 'high_quality',
  Economy = 'economy',
}

export enum MetadataFieldType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  Select = 'select',
}

export type KnowledgeSourceType = 'local_file' | 'text' | 'url' | 'notion' | 'api_source';
export type KnowledgeIconType = 'emoji' | 'image';

export type ChunkMetadata = Record<string, string | number | boolean>;

export type ChunkConfig = {
  chunkMode: ChunkMode;
  chunkSize: number;
  chunkOverlap: number;
  separator: string;
  autoClean: boolean;
};

export type UploadStatus = 'queued' | 'uploading' | 'parsing' | 'completed' | 'failed' | 'canceled';

export type ParseConfig = {
  ocrEnabled: boolean;
  preserveTable: boolean;
  extractImageCaption: boolean;
  chunkMode: ChunkMode;
  chunkSize: number;
  chunkOverlap: number;
  autoVectorize: boolean;
};

export type EmbeddingConfig = {
  embeddingModel: string;
  embeddingDimension: number;
  language: string;
};

export type RetrievalConfig = {
  retrievalMode: RetrievalMode;
  topK: number;
  scoreThreshold: number;
  rerankEnabled: boolean;
  metadataFilter?: ChunkMetadata;
};

export type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  iconType?: KnowledgeIconType;
  iconImageUrl?: string;
  status: KnowledgeStatus;
  sourceType: KnowledgeSourceType;
  documentCount: number;
  chunkCount: number;
  vectorCount?: number;
  indexStatus?: 'not_started' | 'indexing' | 'ready' | 'failed';
  tags?: string[];
  owner?: string;
  indexMode: IndexMode;
  chunkConfig: ChunkConfig;
  embeddingConfig: EmbeddingConfig;
  retrievalConfig: RetrievalConfig;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeDocument = {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  chunkCount: number;
  parserVersion?: string;
  errorMessage?: string;
  lastParsedAt?: string;
  parseConfig?: ParseConfig;
  uploadProgress?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeChunk = {
  id: string;
  knowledgeBaseId: string;
  documentId: string;
  documentName: string;
  content: string;
  tokenCount: number;
  characterCount: number;
  embeddingStatus?: 'pending' | 'embedded' | 'failed';
  hitCount?: number;
  metadata: ChunkMetadata;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MetadataField = {
  id: string;
  knowledgeBaseId: string;
  name: string;
  type: MetadataFieldType;
  description: string;
  source?: 'system' | 'custom';
  tags?: string[];
  updatedAt?: string;
  required?: boolean;
  filterable?: boolean;
  displayInResult?: boolean;
  enabled: boolean;
};

export type RetrievalResult = {
  rank: number;
  score: number;
  documentName: string;
  chunkContent: string;
  metadata: ChunkMetadata;
  tokenCount?: number;
  vectorDistance?: number;
  rerankScore?: number;
  matchedBy?: Array<'vector' | 'full_text' | 'rerank' | 'metadata'>;
};

export type KnowledgeRetrievalTest = {
  id: string;
  knowledgeBaseId: string;
  query: string;
  retrievalMode: RetrievalMode;
  topK: number;
  scoreThreshold: number;
  rerankEnabled: boolean;
  latencyMs: number;
  resultCount: number;
  createdAt: string;
  results?: RetrievalResult[];
};

export type UploadDocumentPayload = {
  knowledgeBaseId: string;
  file: File;
  parseConfig: ParseConfig;
};

export type UploadDocumentTask = {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: UploadStatus;
  progress: number;
  parseConfig: ParseConfig;
  documentId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type PipelineStepStatus = 'success' | 'processing' | 'failed' | 'pending';

export type PipelineTask = {
  id: string;
  knowledgeBaseId: string;
  documentId?: string;
  step: 'upload' | 'clean' | 'chunk' | 'embedding' | 'vector_store';
  status: PipelineStepStatus;
  message: string;
  startedAt: string;
  endedAt?: string;
};

export type CreateKnowledgeBasePayload = {
  name: string;
  description: string;
  icon?: string;
  iconType?: KnowledgeIconType;
  iconImageUrl?: string;
  sourceType: KnowledgeSourceType;
  indexMode: IndexMode;
  chunkConfig: ChunkConfig;
  embeddingConfig: EmbeddingConfig;
  retrievalConfig: RetrievalConfig;
};

export type UpdateKnowledgeBasePayload = Partial<CreateKnowledgeBasePayload> & {
  status?: KnowledgeStatus;
};

export type UpdateKnowledgeBaseOrderPayload = {
  ids: string[];
};

export type CreateChunkPayload = {
  documentId?: string;
  documentName?: string;
  content: string;
  metadata: ChunkMetadata;
};

export type UpdateChunkPayload = Partial<CreateChunkPayload> & {
  enabled?: boolean;
};

export type CreateMetadataFieldPayload = {
  name: string;
  type: MetadataFieldType;
  description: string;
  required?: boolean;
  filterable?: boolean;
  displayInResult?: boolean;
  tags?: string[];
  enabled: boolean;
};

export type UpdateMetadataFieldPayload = Partial<CreateMetadataFieldPayload>;

export type RetrieveTestPayload = RetrievalConfig & {
  query: string;
};
