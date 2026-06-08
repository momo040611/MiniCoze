import {
  ChunkMode,
  DocumentStatus,
  IndexMode,
  KnowledgeStatus,
  RetrievalMode,
  type ChunkConfig,
  type ChunkMetadata,
  type KnowledgeBase,
  type KnowledgeChunk,
  type KnowledgeDocument,
  type ParseConfig,
  type RetrievalResult,
} from './types';

export type KnowledgeChunkType = 'default' | 'custom' | 'leveled';

export type FileAssetDto = {
  id?: string;
  fileId?: string;
  name?: string;
  fileName?: string;
  originalName?: string;
  mimeType?: string;
  type?: string;
  size?: number;
  fileSize?: number;
  url?: string;
  purpose?: string;
  workspaceId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type KnowledgeBaseDto = {
  id: string;
  workspaceId?: string;
  creatorId?: string;
  name?: string;
  description?: string | null;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type KnowledgeDocumentDto = {
  id?: string;
  knowledgeBaseId?: string;
  baseId?: string;
  fileId?: string;
  fileName?: string;
  filename?: string;
  name?: string;
  originalName?: string;
  fileType?: string;
  mimeType?: string;
  type?: string;
  fileSize?: number;
  size?: number;
  status?: string;
  chunkCount?: number;
  chunks?: unknown[];
  parserVersion?: string;
  errorMessage?: string | null;
  lastParsedAt?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  parseConfig?: ParseConfig;
};

export type KnowledgeChunkDto = {
  id?: string;
  knowledgeBaseId?: string;
  documentId?: string;
  documentName?: string;
  fileName?: string;
  index?: number;
  chunkIndex?: number;
  content?: string;
  text?: string;
  tokenCount?: number;
  tokens?: number;
  characterCount?: number;
  charCount?: number;
  metadata?: ChunkMetadata | null;
  enabled?: boolean;
  embeddingStatus?: 'pending' | 'embedded' | 'failed';
  hitCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type RetrievalResultDto = {
  rank?: number;
  score?: number;
  documentName?: string;
  fileName?: string;
  chunkContent?: string;
  content?: string;
  text?: string;
  metadata?: ChunkMetadata | null;
  tokenCount?: number;
  tokens?: number;
  vectorDistance?: number;
  distance?: number;
  rerankScore?: number;
  matchedBy?: Array<'vector' | 'full_text' | 'rerank' | 'metadata'>;
  chunk?: KnowledgeChunkDto;
  document?: { name?: string; fileName?: string };
};

export type KnowledgeChunkConfigDto = {
  chunkType: KnowledgeChunkType;
  chunkSize: number;
  chunkOverlap: number;
  separator?: string;
  autoClean?: boolean;
};

export type KnowledgeChunkPreview = {
  index: number;
  content: string;
  tokenCount: number;
  characterCount: number;
  metadata: ChunkMetadata;
};

type KnowledgeBaseMapOptions = {
  documentCount?: number;
  chunkCount?: number;
  vectorCount?: number;
  overrides?: Partial<KnowledgeBase>;
};

type ChunkMapContext = {
  knowledgeBaseId?: string;
  documentId?: string;
  documentName?: string;
  index?: number;
};

const defaultChunkConfig: ChunkConfig = {
  chunkMode: ChunkMode.General,
  chunkSize: 800,
  chunkOverlap: 100,
  separator: '\n\n',
  autoClean: true,
};

const defaultParseConfig: ParseConfig = {
  ocrEnabled: true,
  preserveTable: true,
  extractImageCaption: false,
  chunkMode: ChunkMode.General,
  chunkSize: 800,
  chunkOverlap: 100,
  autoVectorize: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toStringValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function inferFileType(fileName: string, explicitType?: string) {
  if (explicitType?.trim()) {
    const [, subtype] = explicitType.split('/');
    return (subtype || explicitType).toLowerCase();
  }
  return fileName.split('.').pop()?.toLowerCase() || 'txt';
}

export function normalizeDateTime(value?: string | null) {
  if (!value) return new Date().toISOString();

  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString();

  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const date = new Date(normalized);

  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  return trimmed;
}

export function mapChunkModeToChunkType(mode?: ChunkMode | string): KnowledgeChunkType {
  switch (mode) {
    case ChunkMode.ParentChild:
      return 'leveled';
    case ChunkMode.General:
    case ChunkMode.QA:
      return 'custom';
    default:
      return 'default';
  }
}

export function mapChunkTypeToChunkMode(type?: KnowledgeChunkType | string): ChunkMode {
  switch (type) {
    case 'leveled':
      return ChunkMode.ParentChild;
    case 'custom':
      return ChunkMode.General;
    case 'default':
    default:
      return ChunkMode.General;
  }
}

export function mapDocumentStatus(status?: string): DocumentStatus {
  if (Object.values(DocumentStatus).includes(status as DocumentStatus)) {
    return status as DocumentStatus;
  }
  return DocumentStatus.Completed;
}

export function mapParseConfigToChunkConfig(parseConfig?: ParseConfig): KnowledgeChunkConfigDto {
  const config = parseConfig ?? defaultParseConfig;

  return {
    chunkType: mapChunkModeToChunkType(config.chunkMode),
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
    separator: defaultChunkConfig.separator,
    autoClean: true,
  };
}

export function getFileAssetId(fileAsset: FileAssetDto) {
  const id = fileAsset.id ?? fileAsset.fileId;
  if (!id) {
    throw new Error('File upload response is missing file id');
  }
  return id;
}

export function createChunkViewId(documentId: string, chunkIndex: number) {
  return `${encodeURIComponent(documentId)}:${chunkIndex}`;
}

export function parseChunkViewId(chunkId: string) {
  const separatorIndex = chunkId.lastIndexOf(':');
  if (separatorIndex <= 0) return null;

  const documentId = decodeURIComponent(chunkId.slice(0, separatorIndex));
  const chunkIndex = Number(chunkId.slice(separatorIndex + 1));

  if (!documentId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return null;
  }

  return { documentId, chunkIndex };
}

export function mapKnowledgeBaseDtoToViewModel(
  dto: KnowledgeBaseDto,
  options: KnowledgeBaseMapOptions = {},
): KnowledgeBase {
  const createdAt = normalizeDateTime(dto.createdAt);
  const updatedAt = normalizeDateTime(dto.updatedAt ?? dto.createdAt);
  const enabled = dto.enabled ?? true;
  const overrides = options.overrides ?? {};

  return {
    id: dto.id,
    name: overrides.name ?? dto.name ?? 'Untitled knowledge base',
    description: overrides.description ?? dto.description ?? '',
    icon: overrides.icon,
    iconType: overrides.iconType,
    iconImageUrl: overrides.iconImageUrl,
    status: enabled ? KnowledgeStatus.Active : KnowledgeStatus.Disabled,
    sourceType: overrides.sourceType ?? 'local_file',
    documentCount: options.documentCount ?? overrides.documentCount ?? 0,
    chunkCount: options.chunkCount ?? overrides.chunkCount ?? 0,
    vectorCount: options.vectorCount ?? overrides.vectorCount ?? options.chunkCount ?? 0,
    indexStatus: options.chunkCount || overrides.chunkCount ? 'ready' : 'not_started',
    tags: overrides.tags ?? [],
    owner: overrides.owner ?? 'MiniCoze',
    indexMode: overrides.indexMode ?? IndexMode.HighQuality,
    chunkConfig: overrides.chunkConfig ?? defaultChunkConfig,
    embeddingConfig: overrides.embeddingConfig ?? {
      embeddingModel: 'text-embedding-3-large',
      embeddingDimension: 3072,
      language: 'zh-CN',
    },
    retrievalConfig: overrides.retrievalConfig ?? {
      retrievalMode: RetrievalMode.Vector,
      topK: 5,
      scoreThreshold: 0.35,
      rerankEnabled: false,
    },
    createdAt,
    updatedAt,
  };
}

export function mapKnowledgeDocumentDtoToViewModel(
  dto: KnowledgeDocumentDto,
  knowledgeBaseId: string,
  parseConfig?: ParseConfig,
): KnowledgeDocument {
  const fileName = dto.fileName ?? dto.filename ?? dto.originalName ?? dto.name ?? 'Untitled document';
  const explicitType = dto.fileType ?? dto.mimeType ?? dto.type;
  const createdAt = normalizeDateTime(dto.createdAt);
  const updatedAt = normalizeDateTime(dto.updatedAt ?? dto.createdAt);

  return {
    id: dto.id ?? dto.fileId ?? fileName,
    knowledgeBaseId: dto.knowledgeBaseId ?? dto.baseId ?? knowledgeBaseId,
    fileName,
    fileType: inferFileType(fileName, explicitType),
    fileSize: dto.fileSize ?? dto.size ?? 0,
    status: mapDocumentStatus(dto.status),
    chunkCount: dto.chunkCount ?? dto.chunks?.length ?? 0,
    parserVersion: dto.parserVersion ?? 'knowledge-v1',
    errorMessage: dto.errorMessage ?? undefined,
    lastParsedAt: normalizeDateTime(dto.lastParsedAt ?? dto.updatedAt ?? dto.createdAt),
    parseConfig: dto.parseConfig ?? parseConfig ?? defaultParseConfig,
    uploadProgress: 100,
    enabled: dto.enabled ?? true,
    createdAt,
    updatedAt,
  };
}

export function mapChunkDtoToViewModel(dto: KnowledgeChunkDto, context: ChunkMapContext = {}): KnowledgeChunk {
  const documentId = dto.documentId ?? context.documentId ?? '';
  const chunkIndex = dto.chunkIndex ?? dto.index ?? context.index ?? 0;
  const content = dto.content ?? dto.text ?? '';
  const createdAt = normalizeDateTime(dto.createdAt);
  const updatedAt = normalizeDateTime(dto.updatedAt ?? dto.createdAt);

  return {
    id: createChunkViewId(documentId, chunkIndex),
    knowledgeBaseId: dto.knowledgeBaseId ?? context.knowledgeBaseId ?? '',
    documentId,
    documentName: dto.documentName ?? dto.fileName ?? context.documentName ?? 'Document',
    content,
    tokenCount: dto.tokenCount ?? dto.tokens ?? Math.ceil(content.length / 2),
    characterCount: dto.characterCount ?? dto.charCount ?? content.length,
    embeddingStatus: dto.embeddingStatus ?? 'embedded',
    hitCount: dto.hitCount ?? 0,
    metadata: dto.metadata ?? {},
    enabled: dto.enabled ?? true,
    createdAt,
    updatedAt,
  };
}

export function mapRetrieveResultDtoToViewModel(dto: RetrievalResultDto, index: number): RetrievalResult {
  const chunk = isRecord(dto.chunk) ? (dto.chunk as KnowledgeChunkDto) : undefined;
  const document = isRecord(dto.document) ? dto.document : undefined;
  const content = dto.chunkContent ?? dto.content ?? dto.text ?? chunk?.content ?? chunk?.text ?? '';
  const score = toNumberValue(dto.score, 0);

  return {
    rank: dto.rank ?? index + 1,
    score,
    documentName:
      dto.documentName ??
      dto.fileName ??
      document?.name ??
      document?.fileName ??
      chunk?.documentName ??
      chunk?.fileName ??
      'Document',
    chunkContent: content,
    metadata: dto.metadata ?? chunk?.metadata ?? {},
    tokenCount: dto.tokenCount ?? dto.tokens ?? chunk?.tokenCount ?? chunk?.tokens,
    vectorDistance: dto.vectorDistance ?? dto.distance ?? Number((1 - score).toFixed(3)),
    rerankScore: dto.rerankScore,
    matchedBy: dto.matchedBy ?? ['vector'],
  };
}

export function mapPreviewChunkToViewModel(value: unknown, index: number): KnowledgeChunkPreview {
  if (typeof value === 'string') {
    return {
      index,
      content: value,
      tokenCount: Math.ceil(value.length / 2),
      characterCount: value.length,
      metadata: {},
    };
  }

  if (!isRecord(value)) {
    return {
      index,
      content: '',
      tokenCount: 0,
      characterCount: 0,
      metadata: {},
    };
  }

  const content = toStringValue(value.content ?? value.text, '');
  const metadata = isRecord(value.metadata) ? (value.metadata as ChunkMetadata) : {};

  return {
    index: toNumberValue(value.index ?? value.chunkIndex, index),
    content,
    tokenCount: toNumberValue(value.tokenCount ?? value.tokens, Math.ceil(content.length / 2)),
    characterCount: toNumberValue(value.characterCount ?? value.charCount, content.length),
    metadata,
  };
}
