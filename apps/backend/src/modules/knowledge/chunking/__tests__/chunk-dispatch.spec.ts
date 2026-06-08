import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { chunk } from '../chunk';

describe('chunk dispatch', () => {
  it('default + txt 调通且 meta.totalChunks 等于 chunks.length', () => {
    const result = chunk('hello\n\nworld', 'txt', { chunkType: 'default' });
    expect(result.meta.chunkType).toBe('default');
    expect(result.meta.fileExtension).toBe('txt');
    expect(result.meta.totalChunks).toBe(result.chunks.length);
    expect(result.meta.totalChars).toBe(
      result.chunks.reduce((a, c) => a + c.charCount, 0),
    );
  });

  it('leveled + md 调通', () => {
    const result = chunk('# A\naa', 'md', {
      chunkType: 'leveled',
      maxDepth: 3,
      saveTitle: true,
    });
    expect(result.meta.chunkType).toBe('leveled');
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it('custom + txt 调通', () => {
    const result = chunk('abcdefghij', 'txt', {
      chunkType: 'custom',
      chunkSize: 5,
      overlap: 0,
      separator: '\n\n',
      trimSpace: false,
      trimUrlAndEmail: false,
    });
    expect(result.meta.chunkType).toBe('custom');
    expect(result.chunks).toHaveLength(2);
  });

  it('leveled + txt 抛 KnowledgeChunkConfigInvalid', () => {
    expect(() =>
      chunk('hi', 'txt', {
        chunkType: 'leveled',
        maxDepth: 3,
        saveTitle: true,
      }),
    ).toThrow(BusinessException);
    try {
      chunk('hi', 'txt', {
        chunkType: 'leveled',
        maxDepth: 3,
        saveTitle: true,
      });
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }
  });

  it('不支持的扩展名抛 KnowledgeFileTypeUnsupported', () => {
    expect(() => chunk('hi', 'pdf', { chunkType: 'default' })).toThrow(
      BusinessException,
    );
    try {
      chunk('hi', 'pdf', { chunkType: 'default' });
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeFileTypeUnsupported,
      );
    }
  });

  it('未知 chunkType 抛 KnowledgeChunkConfigInvalid', () => {
    expect(() => chunk('hi', 'txt', { chunkType: 'unknown' as never })).toThrow(
      BusinessException,
    );
  });
});
