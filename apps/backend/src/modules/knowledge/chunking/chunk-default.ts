import { chunkCustom } from './chunk-custom';
import { DEFAULT_CUSTOM_CONFIG, type Chunk } from './types';

// 自动切分（default）：使用内置默认参数复用 chunkCustom。
export function chunkDefault(text: string): Chunk[] {
  return chunkCustom(text, { chunkType: 'custom', ...DEFAULT_CUSTOM_CONFIG });
}
