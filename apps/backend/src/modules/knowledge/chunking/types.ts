// 切分模块的核心类型定义。
// 本文件仅声明类型与常量，不含运行时分支逻辑。

export const SUPPORTED_EXTENSIONS = ['txt', 'md'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export type ChunkType = 'default' | 'custom' | 'leveled';

// 自定义切分策略参数，对齐 coze-studio backend/infra/document/parser/manager.go ChunkingStrategy。
export interface CustomConfig {
  chunkType: 'custom';
  chunkSize: number;
  overlap: number; // 0-99 之间的百分比
  separator: string;
  trimSpace: boolean;
  trimUrlAndEmail: boolean;
}

// 自动切分仅承载 chunkType 标记，参数从 DEFAULT_CUSTOM_CONFIG 取。
export interface DefaultConfig {
  chunkType: 'default';
}

// 层级切分仅适用于 markdown。
export interface LeveledConfig {
  chunkType: 'leveled';
  maxDepth: number; // 1-6
  saveTitle: boolean;
}

export type ChunkConfig = DefaultConfig | CustomConfig | LeveledConfig;

export interface Chunk {
  index: number;
  content: string;
  charCount: number;
}

export interface ChunkMeta {
  chunkType: ChunkType;
  fileExtension: SupportedExtension;
  totalChunks: number;
  totalChars: number;
}

export interface ChunkResult {
  meta: ChunkMeta;
  chunks: Chunk[];
}

// default 策略对应的 custom 默认参数。
export const DEFAULT_CUSTOM_CONFIG: Omit<CustomConfig, 'chunkType'> = {
  chunkSize: 800,
  overlap: 10,
  separator: '\n\n',
  trimSpace: true,
  trimUrlAndEmail: false,
};
