import { FilePurpose, FileStatus, FileVisibility } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { FileService } from '../file/file.service';
import { KnowledgeService } from './knowledge.service';

const buildFile = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'f1',
  workspaceId: 'ws1',
  ownerId: 'u1',
  purpose: FilePurpose.KNOWLEDGE_DOCUMENT,
  visibility: FileVisibility.PRIVATE,
  status: FileStatus.READY,
  originalName: 'demo.txt',
  mimeType: 'text/plain',
  extension: '.txt',
  size: 10,
  url: '/api/files/f1/content',
  deletedAt: null,
  createdAt: '2026-06-05 10:00:00',
  updatedAt: '2026-06-05 10:00:00',
  ...overrides,
});

describe('KnowledgeService', () => {
  const buildService = (
    fileOverrides = {},
    buffer = Buffer.from('hello\n\nworld', 'utf8'),
  ) => {
    const fileService = {
      getReadyFileForUser: jest
        .fn()
        .mockResolvedValue(buildFile(fileOverrides)),
      getFileBufferForInternal: jest.fn().mockResolvedValue(buffer),
    } as unknown as FileService;
    return {
      service: new KnowledgeService(fileService),
      fileService: fileService as jest.Mocked<FileService>,
    };
  };

  it('default 切分 txt：使用 FileAsset.id 返回 chunks 与 meta', async () => {
    const { service, fileService } = buildService({ originalName: 'demo.txt' });

    const result = await service.chunkDocument('u1', 'f1', {
      chunkType: 'default',
    });

    expect(fileService.getReadyFileForUser).toHaveBeenCalledWith('f1', {
      id: 'u1',
      email: '',
      username: '',
    });
    expect(fileService.getFileBufferForInternal).toHaveBeenCalledWith('f1');
    expect(result.meta.fileExtension).toBe('txt');
    expect(result.meta.chunkType).toBe('default');
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it('leveled 切分 md：调通', async () => {
    const { service } = buildService(
      { originalName: 'guide.md', extension: '.md', mimeType: 'text/markdown' },
      Buffer.from('# A\naa\n## B\nbb', 'utf8'),
    );
    const result = await service.chunkDocument('u1', 'f1', {
      chunkType: 'leveled',
      maxDepth: 3,
      saveTitle: true,
    });
    expect(result.meta.fileExtension).toBe('md');
    expect(result.chunks.length).toBe(2);
  });

  it('文件 purpose 非 KNOWLEDGE_DOCUMENT：抛 KnowledgeFileTypeUnsupported', async () => {
    const { service } = buildService({ purpose: FilePurpose.CHAT_ATTACHMENT });
    try {
      await service.chunkDocument('u1', 'f1', { chunkType: 'default' });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeFileTypeUnsupported,
      );
    }
  });

  it('扩展名为 pdf：抛 KnowledgeFileTypeUnsupported', async () => {
    const { service } = buildService({
      originalName: 'spec.pdf',
      extension: '.pdf',
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
    const { service } = buildService();
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
    const { service } = buildService(
      { originalName: 'demo.txt' },
      Buffer.from('hi'),
    );
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
