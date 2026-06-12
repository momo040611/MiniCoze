import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import type { Chunk, CustomConfig } from './types';

const SPACE_REGEX = /\s+/g;
const URL_REGEX = /https?:\/\/\S+|www\.\S+/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// 把字符串转成 rune（码点）数组，避免按 UTF-16 code unit 截断造成半个 emoji。
function toRunes(text: string): string[] {
  return Array.from(text);
}

function trimText(
  text: string,
  cfg: Pick<CustomConfig, 'trimSpace' | 'trimUrlAndEmail'>,
): string {
  let out = text;
  if (cfg.trimUrlAndEmail) {
    out = out.replace(URL_REGEX, '');
    out = out.replace(EMAIL_REGEX, '');
  }
  if (cfg.trimSpace) {
    out = out.replace(SPACE_REGEX, ' ').trim();
  }
  return out;
}

// overlap 为百分比（0-99），返回需要保留为下一 chunk 起始的 rune 数组。
function getOverlapTail(
  prevContentRunes: string[],
  overlapPercent: number,
  chunkSize: number,
): string[] {
  const overlap = Math.floor((chunkSize * overlapPercent) / 100);
  if (overlap <= 0) return [];
  if (prevContentRunes.length <= overlap) return prevContentRunes.slice();
  return prevContentRunes.slice(prevContentRunes.length - overlap);
}

/**
 * 自定义切分：
 *   1. 按 separator 切段
 *   2. 每段 trim 后按 chunkSize（rune 数）切片
 *   3. flush 时根据 overlap 比例回填下一个 chunk 的开头
 *
 * 算法对齐 coze-studio backend/infra/document/parser/impl/builtin/chunk_custom.go。
 */
export function chunkCustom(
  text: string,
  cfg: Omit<CustomConfig, 'chunkType'> & { chunkType?: 'custom' },
): Chunk[] {
  if (cfg.overlap < 0 || cfg.overlap >= 100) {
    throw new BusinessException(
      'overlap must be between 0 and 99',
      ErrorCode.KnowledgeChunkConfigInvalid,
    );
  }
  if (text.length === 0) return [];

  const chunks: Chunk[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const content = buffer.join('');
    chunks.push({
      index: chunks.length,
      content,
      charCount: buffer.length,
    });
    // overlap 接续：取上一 chunk 尾部 rune 作为下一 buffer 起点。
    buffer = getOverlapTail(buffer, cfg.overlap, cfg.chunkSize);
  };

  const processPart = (part: string) => {
    let runes = toRunes(part);
    while (runes.length > 0) {
      const remain = cfg.chunkSize - buffer.length;
      const take = Math.min(runes.length, remain);
      for (let i = 0; i < take; i++) buffer.push(runes[i]);
      runes = runes.slice(take);
      if (buffer.length >= cfg.chunkSize) {
        flush();
      }
    }
  };

  const parts = text.split(cfg.separator);
  for (let i = 0; i < parts.length; i++) {
    const trimmed = trimText(parts[i], cfg);
    if (trimmed.length === 0) continue;
    processPart(trimmed);
    // separator 边界：当前段处理完后强制 flush，使段不跨 chunk 合并。
    if (i < parts.length - 1 && buffer.length > 0) {
      flush();
      // 段边界处不应保留 overlap 前缀（避免污染下一段开头）。
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    // 最后一段尾部，flush 后不再需要 overlap 回填。
    chunks.push({
      index: chunks.length,
      content: buffer.join(''),
      charCount: buffer.length,
    });
    buffer = [];
  }

  return chunks;
}
