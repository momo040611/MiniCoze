export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

export type PipelineStatus = 'draft' | 'published' | 'disabled';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export type PipelineStepType =
  | 'file_upload'
  | 'document_parse'
  | 'text_clean'
  | 'document_chunk'
  | 'metadata_extract'
  | 'embedding'
  | 'vector_store'
  | 'retrieval_test';

export type DocumentParseConfig = {
  ocrEnabled: boolean;
  preserveTable: boolean;
  extractImages: boolean;
  supportedFormats: Array<'PDF' | 'DOCX' | 'TXT' | 'Markdown'>;
};

export type TextCleanConfig = {
  removeBlankLines: boolean;
  removeUrls: boolean;
  removeEmails: boolean;
  mergeSpaces: boolean;
};

export type DocumentChunkConfig = {
  mode: 'character' | 'heading' | 'markdown' | 'semantic';
  chunkSize: number;
  chunkOverlap: number;
  parentChildEnabled: boolean;
};

export type EmbeddingStepConfig = {
  model: 'text-embedding-3-large' | 'bge-large' | 'custom';
  batchSize: number;
  retryTimes: number;
};

export type VectorStoreConfig = {
  type: 'Mock' | 'Milvus' | 'Qdrant' | 'PGVector';
  indexMode: 'high_quality' | 'high_performance';
  hybridSearchEnabled: boolean;
};

export type RetrievalTestConfig = {
  topK: number;
  scoreThreshold: number;
  rerankEnabled: boolean;
};

export type PipelineStepConfig =
  | DocumentParseConfig
  | TextCleanConfig
  | DocumentChunkConfig
  | EmbeddingStepConfig
  | VectorStoreConfig
  | RetrievalTestConfig
  | Record<string, never>;

export type PipelineStep = {
  id: string;
  type: PipelineStepType;
  name: string;
  description: string;
  enabled: boolean;
  retryEnabled: boolean;
  retryTimes: number;
  config: PipelineStepConfig;
};

export type KnowledgePipeline = {
  id: string;
  name: string;
  description: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  status: PipelineStatus;
  version: number;
  convertedAt?: string;
  updatedAt: string;
  steps: PipelineStep[];
};

export type PipelineLog = {
  id: string;
  runId: string;
  stepId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  createdAt: string;
};

export type PipelineRunStep = {
  id: string;
  stepId: string;
  type: PipelineStepType;
  name: string;
  status: StepStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  retryCount: number;
  failureReason?: string;
};

export type PipelineRun = {
  id: string;
  pipelineId: string;
  knowledgeBaseId: string;
  pipelineName: string;
  pipelineVersion: number;
  status: StepStatus;
  progress: number;
  startedAt: string;
  updatedAt: string;
  steps: PipelineRunStep[];
  logs: PipelineLog[];
};

export type SavePipelinePayload = Pick<
  KnowledgePipeline,
  'name' | 'description' | 'knowledgeBaseId' | 'knowledgeBaseName' | 'steps'
> & {
  status?: PipelineStatus;
};
