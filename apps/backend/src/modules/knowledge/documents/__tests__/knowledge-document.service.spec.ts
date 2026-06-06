import { FilePurpose, FileStatus, FileVisibility } from '@prisma/client';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PrismaService } from '../../../../database/prisma.service';
import { FileService } from '../../../file/file.service';
import { KnowledgeBaseService } from '../../bases/knowledge-base.service';
import type { Embedder } from '../../embedding/embedder.interface';
import { RetrievalService } from '../../retrieval/retrieval.service';
import { KnowledgeDocumentService } from '../knowledge-document.service';

const buildKb = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'kb1',
  workspaceId: 'ws1',
  creatorId: 'u1',
  name: 'KB',
  description: null,
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildFileAsset = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'f1',
  workspaceId: 'ws1',
  ownerId: 'u1',
  purpose: FilePurpose.KNOWLEDGE_DOCUMENT,
  visibility: FileVisibility.PRIVATE,
  status: FileStatus.READY,
  originalName: 'demo.md',
  storageKey: 'knowledge-document/2026/06/f1.md',
  url: '/api/files/f1/content',
  mimeType: 'text/markdown',
  extension: '.md',
  size: 100,
  checksum: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildDoc = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'doc1',
  knowledgeBaseId: 'kb1',
  workspaceId: 'ws1',
  fileId: 'f1',
  creatorId: 'u1',
  name: 'demo.txt',
  status: 'READY',
  chunkCount: 2,
  tokenCount: 0,
  totalChars: 10,
  chunkType: 'default',
  chunkConfig: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  file: buildFileAsset({ originalName: 'demo.txt', extension: '.txt' }),
  ...overrides,
});

const makeEmbedder = (vectors: number[][], dimensions = 1024): Embedder => ({
  model: 'mock',
  dimensions,
  embed: jest.fn().mockResolvedValue(vectors),
});

describe('KnowledgeDocumentService', () => {
  let prisma: {
    knowledgeDocument: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let kbService: { findOneForUser: jest.Mock };
  let fileService: {
    getReadyFileForUser: jest.Mock;
    getFileBufferForInternal: jest.Mock;
  };
  let retrievalService: { indexChunks: jest.Mock };
  let txMock: {
    knowledgeDocument: { create: jest.Mock };
    $executeRaw: jest.Mock;
  };

  const buildService = (embedder: Embedder) =>
    new KnowledgeDocumentService(
      prisma as unknown as PrismaService,
      kbService as unknown as KnowledgeBaseService,
      fileService as unknown as FileService,
      embedder,
      retrievalService as unknown as RetrievalService,
    );

  beforeEach(() => {
    txMock = {
      knowledgeDocument: { create: jest.fn().mockResolvedValue(buildDoc()) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma = {
      knowledgeDocument: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: typeof txMock) => unknown) => {
        return cb(txMock);
      }),
      $queryRaw: jest.fn(),
    };
    kbService = {
      findOneForUser: jest.fn().mockResolvedValue(buildKb()),
    };
    fileService = {
      getReadyFileForUser: jest.fn().mockResolvedValue(buildFileAsset()),
      getFileBufferForInternal: jest
        .fn()
        .mockResolvedValue(Buffer.from('hello world', 'utf8')),
    };
    retrievalService = {
      indexChunks: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('happy path: FileAsset → 切分 → 向量化 → 写 document + chunks，保留文件资产', async () => {
    const embedder = makeEmbedder([new Array(1024).fill(0.1)]);
    const service = buildService(embedder);

    const out = await service.chunkAndIngest('u1', 'kb1', 'f1', {
      chunkType: 'default',
    });

    expect(kbService.findOneForUser).toHaveBeenCalledWith('u1', 'kb1');
    expect(fileService.getReadyFileForUser).toHaveBeenCalledWith('f1', {
      id: 'u1',
      email: '',
      username: '',
    });
    expect(fileService.getFileBufferForInternal).toHaveBeenCalledWith('f1');
    expect(embedder.embed).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.knowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileId: 'f1',
          name: 'demo.md',
        }),
        include: { file: true },
      }),
    );
    expect(txMock.$executeRaw).toHaveBeenCalledTimes(1);
    expect(out.document.id).toBe('doc1');

    const insertSql = txMock.$executeRaw.mock.calls[0][0].join('');
    expect(insertSql).toContain('"documentId"');
    expect(insertSql).toContain('"knowledgeBaseId"');
    expect(insertSql).toContain('"workspaceId"');
    expect(insertSql).toContain('"content"');
    expect(insertSql).toContain('"index"');
    expect(insertSql).toContain('"vectorId"');
    expect(insertSql).toContain('"updatedAt"');
    expect(insertSql).not.toContain('"chunkIndex"');
    expect(insertSql).not.toContain('"charCount"');
    expect(insertSql).not.toContain('"embedding"');

    // Unit 4: 向量也写入 KnowledgeChunkVector
    expect(retrievalService.indexChunks).toHaveBeenCalledTimes(1);
    const [tx, rows, model, dim] = retrievalService.indexChunks.mock.calls[0];
    expect(tx).toBe(txMock);
    expect(rows).toHaveLength(1);
    expect(rows[0].chunkId).toEqual(expect.any(String));
    expect(rows[0].vector).toHaveLength(1024);
    expect(model).toBe('mock');
    expect(dim).toBe(1024);
  });

  it('Unit 4: indexChunks 收到的 chunkId 与 INSERT SQL 用的 chunkId 一致', async () => {
    const embedder = makeEmbedder([new Array(1024).fill(0.1)]);
    const service = buildService(embedder);

    await service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' });

    // INSERT SQL 第一参数（${chunkIds[i]}）应等于 indexChunks rows[0].chunkId
    const insertParams = txMock.$executeRaw.mock.calls[0].slice(1);
    const insertedChunkId = insertParams[0];
    const indexedChunkId =
      retrievalService.indexChunks.mock.calls[0][1][0].chunkId;
    expect(insertedChunkId).toBe(indexedChunkId);
  });

  it('Unit 4: indexChunks 抛维度异常 → 事务整体抛错（向量与 chunk 一并回滚）', async () => {
    const embedder = makeEmbedder([new Array(1024).fill(0.1)]);
    retrievalService.indexChunks.mockRejectedValueOnce(
      new BusinessException(
        'dim mismatch',
        ErrorCode.KnowledgeVectorDimensionMismatch,
      ),
    );
    const service = buildService(embedder);

    try {
      await service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeVectorDimensionMismatch,
      );
    }
  });

  it('文件 purpose 非 KNOWLEDGE_DOCUMENT → KnowledgeFileTypeUnsupported', async () => {
    fileService.getReadyFileForUser.mockResolvedValueOnce(
      buildFileAsset({ purpose: FilePurpose.CHAT_ATTACHMENT }),
    );
    const service = buildService(makeEmbedder([]));

    try {
      await service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeFileTypeUnsupported,
      );
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('扩展名不支持（FileAsset 是 pdf） → KnowledgeFileTypeUnsupported', async () => {
    fileService.getReadyFileForUser.mockResolvedValueOnce(
      buildFileAsset({ originalName: 'demo.pdf', extension: '.pdf' }),
    );
    const service = buildService(makeEmbedder([]));

    try {
      await service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeFileTypeUnsupported,
      );
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('config 非法 → KnowledgeChunkConfigInvalid', async () => {
    const service = buildService(makeEmbedder([]));

    try {
      await service.chunkAndIngest('u1', 'kb1', 'f1', { invalid: true });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }
  });

  it('embedder 失败抛错 → 不进事务，文件资产保留', async () => {
    const embedder: Embedder = {
      model: 'mock',
      dimensions: 1024,
      embed: jest
        .fn()
        .mockRejectedValue(
          new BusinessException(
            'provider down',
            ErrorCode.KnowledgeEmbeddingFailed,
          ),
        ),
    };
    const service = buildService(embedder);

    await expect(
      service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' }),
    ).rejects.toMatchObject({ message: expect.stringContaining('provider down') });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('KB 不存在 → KnowledgeBaseNotFound', async () => {
    kbService.findOneForUser.mockRejectedValueOnce(
      new BusinessException('not found', ErrorCode.KnowledgeBaseNotFound),
    );
    const service = buildService(makeEmbedder([]));

    await expect(
      service.chunkAndIngest('u1', 'missing', 'f1', { chunkType: 'default' }),
    ).rejects.toMatchObject({ message: expect.stringContaining('not found') });
    expect(fileService.getReadyFileForUser).not.toHaveBeenCalled();
  });

  it('文件不存在 → 透传文件服务错误', async () => {
    fileService.getReadyFileForUser.mockRejectedValueOnce(
      new BusinessException('文件不存在', ErrorCode.NotFound),
    );
    const service = buildService(makeEmbedder([]));

    try {
      await service.chunkAndIngest('u1', 'kb1', 'missing', {
        chunkType: 'default',
      });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(ErrorCode.NotFound);
    }
  });

  it('listByKnowledgeBase: 校验 KB 后 findMany', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValueOnce([
      buildDoc({ id: 'doc1' }),
      buildDoc({ id: 'doc2' }),
    ]);
    const service = buildService(makeEmbedder([]));
    const out = await service.listByKnowledgeBase('u1', 'kb1');
    expect(out).toHaveLength(2);
  });

  it('listByKnowledgeBase: 响应包含 chunkConfig（用于回显）', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValueOnce([
      buildDoc({
        chunkConfig: { chunkType: 'custom', chunkSize: 450, overlap: 10 },
      }),
    ]);
    const service = buildService(makeEmbedder([]));
    const out = await service.listByKnowledgeBase('u1', 'kb1');
    expect(out[0].chunkConfig).toEqual({
      chunkType: 'custom',
      chunkSize: 450,
      overlap: 10,
    });
  });

  it('remove: 不存在 → KnowledgeDocumentNotFound', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce(null);
    const service = buildService(makeEmbedder([]));
    try {
      await service.remove('u1', 'missing');
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeDocumentNotFound,
      );
    }
  });

  it('remove: 存在 → 校验 KB 成员后 delete', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce(buildDoc());
    prisma.knowledgeDocument.delete.mockResolvedValueOnce(buildDoc());
    const service = buildService(makeEmbedder([]));

    await service.remove('u1', 'doc1');
    expect(kbService.findOneForUser).toHaveBeenCalledWith('u1', 'kb1');
    expect(prisma.knowledgeDocument.delete).toHaveBeenCalledWith({
      where: { id: 'doc1' },
      include: { file: true },
    });
  });
});
