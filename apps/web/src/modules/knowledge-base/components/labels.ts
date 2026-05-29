import {
  ChunkMode,
  DocumentStatus,
  IndexMode,
  KnowledgeStatus,
  MetadataFieldType,
  RetrievalMode,
  type KnowledgeSourceType,
  type PipelineTask,
} from '../../../api/knowledge-base';

export const knowledgeStatusText: Record<KnowledgeStatus, string> = {
  [KnowledgeStatus.Active]: '可用',
  [KnowledgeStatus.Indexing]: '索引中',
  [KnowledgeStatus.Disabled]: '已停用',
  [KnowledgeStatus.Failed]: '失败',
};

export const documentStatusText: Record<DocumentStatus, string> = {
  [DocumentStatus.Pending]: '等待中',
  [DocumentStatus.Uploading]: '上传中',
  [DocumentStatus.Parsing]: '解析中',
  [DocumentStatus.Completed]: '已完成',
  [DocumentStatus.Failed]: '失败',
  [DocumentStatus.Canceled]: '已取消',
};

export const retrievalModeText: Record<RetrievalMode, string> = {
  [RetrievalMode.Vector]: '向量检索',
  [RetrievalMode.FullText]: '全文检索',
  [RetrievalMode.Hybrid]: '混合检索',
};

export const chunkModeText: Record<ChunkMode, string> = {
  [ChunkMode.General]: '通用分段',
  [ChunkMode.ParentChild]: '父子分段',
  [ChunkMode.QA]: '问答分段',
};

export const indexModeText: Record<IndexMode, string> = {
  [IndexMode.HighQuality]: '高质量索引',
  [IndexMode.Economy]: '经济索引',
};

export const metadataFieldTypeText: Record<MetadataFieldType, string> = {
  [MetadataFieldType.String]: '文本',
  [MetadataFieldType.Number]: '数字',
  [MetadataFieldType.Boolean]: '布尔',
  [MetadataFieldType.Date]: '日期',
  [MetadataFieldType.Select]: '下拉选项',
};

export const sourceTypeText: Record<KnowledgeSourceType, string> = {
  local_file: '本地文件',
  text: '文本',
  url: '网页链接',
  notion: 'Notion',
  api_source: 'API 数据源',
};

export const pipelineStepText: Record<PipelineTask['step'], string> = {
  upload: '上传',
  clean: '清洗',
  chunk: '分段',
  embedding: '向量化',
  vector_store: '入库',
};
