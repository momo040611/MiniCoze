import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { chunkCustom } from './chunk-custom';
import { chunkDefault } from './chunk-default';
import { chunkLeveled } from './chunk-leveled';
import {
  SUPPORTED_EXTENSIONS,
  type ChunkConfig,
  type ChunkResult,
  type SupportedExtension,
} from './types';

function isSupportedExtension(ext: string): ext is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * 切分调度入口：根据 chunkType + 文件扩展名分发到具体策略。
 * 不支持的扩展名 / 策略-扩展名组合 / 未知策略均抛 BusinessException。
 */
export function chunk(
  text: string,
  extension: string,
  config: ChunkConfig,
): ChunkResult {
  const ext = extension.toLowerCase();
  if (!isSupportedExtension(ext)) {
    throw new BusinessException(
      `unsupported file extension: ${extension}`,
      ErrorCode.KnowledgeFileTypeUnsupported,
    );
  }

  let chunks;
  switch (config.chunkType) {
    case 'default':
      chunks = chunkDefault(text);
      break;
    case 'custom':
      chunks = chunkCustom(text, config);
      break;
    case 'leveled':
      if (ext !== 'md') {
        throw new BusinessException(
          'leveled chunking only supports md files',
          ErrorCode.KnowledgeChunkConfigInvalid,
        );
      }
      chunks = chunkLeveled(text, config);
      break;
    default: {
      const unknown = (config as { chunkType?: string }).chunkType;
      throw new BusinessException(
        `unknown chunkType: ${String(unknown)}`,
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }
  }

  return {
    meta: {
      chunkType: config.chunkType,
      fileExtension: ext,
      totalChunks: chunks.length,
      totalChars: chunks.reduce((sum, c) => sum + c.charCount, 0),
    },
    chunks,
  };
}
