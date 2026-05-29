import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { KnowledgeService } from './knowledge.service';
import { UploadStageService } from './uploads/upload-stage.service';

const buildStage = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'stage1',
  fileId: 'f1',
  uploaderId: 'u1',
  originalName: 'demo.txt',
  fileExtension: 'txt',
  fileSize: 10,
  storagePath: '/tmp/x',
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
  ...overrides,
});

describe('KnowledgeService', () => {
  const buildService = (loadResult: unknown) => {
    const stage = {
      loadForUser: jest.fn().mockResolvedValue(loadResult),
    } as unknown as UploadStageService;
    return new KnowledgeService(stage);
  };

  it('default 切分 txt：返回 chunks 与 meta', async () => {
    const service = buildService({
      stage: buildStage({ originalName: 'demo.txt', fileExtension: 'txt' }),
      buffer: Buffer.from('hello\n\nworld', 'utf8'),
    });
    const result = await service.chunkDocument('u1', 'f1', {
      chunkType: 'default',
    });
    expect(result.meta.fileExtension).toBe('txt');
    expect(result.meta.chunkType).toBe('default');
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it('leveled 切分 md：调通', async () => {
    const service = buildService({
      stage: buildStage({ originalName: 'guide.md', fileExtension: 'md' }),
      buffer: Buffer.from('# A\naa\n## B\nbb', 'utf8'),
    });
    const result = await service.chunkDocument('u1', 'f1', {
      chunkType: 'leveled',
      maxDepth: 3,
      saveTitle: true,
    });
    expect(result.meta.fileExtension).toBe('md');
    expect(result.chunks.length).toBe(2);
  });

  it('扩展名为 pdf：抛 KnowledgeFileTypeUnsupported', async () => {
    const service = buildService({
      stage: buildStage({ originalName: 'spec.pdf', fileExtension: 'pdf' }),
      buffer: Buffer.from('x'),
    });
    try {
      await service.chunkDocument('u1', 'f1', { chunkType: 'default' });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeFileTypeUnsupported,
      );
    }
  });

  it('config 不合法 → KnowledgeChunkConfigInvalid', async () => {
    const service = buildService({
      stage: buildStage(),
      buffer: Buffer.from('x'),
    });
    try {
      await service.chunkDocument('u1', 'f1', { invalid: 'value' });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }
  });

  it('leveled 用于 txt：抛 KnowledgeChunkConfigInvalid', async () => {
    const service = buildService({
      stage: buildStage({ originalName: 'demo.txt', fileExtension: 'txt' }),
      buffer: Buffer.from('hi'),
    });
    try {
      await service.chunkDocument('u1', 'f1', {
        chunkType: 'leveled',
        maxDepth: 3,
        saveTitle: true,
      });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }
  });
});
