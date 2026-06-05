import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PrismaService } from '../../../../database/prisma.service';
import { KnowledgeBaseService } from '../../bases/knowledge-base.service';
import type { Embedder } from '../../embedding/embedder.interface';
import { UploadStageService } from '../../uploads/upload-stage.service';
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
  file: {
    id: 'f1',
    originalName: 'demo.txt',
    extension: 'txt',
    size: 100,
  },
  ...overrides,
});

const buildStage = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'stage1',
  fileId: 'f1',
  uploaderId: 'u1',
  originalName: 'demo.md',
  fileExtension: 'md',
  fileSize: 11,
  storagePath: '/tmp/x',
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
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
  let stageService: {
    loadForUser: jest.Mock;
    removeAfterIngest: jest.Mock;
  };
  let txMock: {
    knowledgeDocument: { create: jest.Mock };
    $executeRaw: jest.Mock;
  };

  const buildService = (embedder: Embedder) =>
    new KnowledgeDocumentService(
      prisma as unknown as PrismaService,
      kbService as unknown as KnowledgeBaseService,
      stageService as unknown as UploadStageService,
      embedder,
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
    stageService = {
      loadForUser: jest.fn().mockResolvedValue({
        stage: buildStage(),
        buffer: Buffer.from('hello world', 'utf8'),
      }),
      removeAfterIngest: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('happy path: stage → 切分 → 向量化 → 写 document + chunks → 清 stage', async () => {
    const embedder = makeEmbedder([new Array(1024).fill(0.1)]);
    const service = buildService(embedder);

    const out = await service.chunkAndIngest('u1', 'kb1', 'f1', {
      chunkType: 'default',
    });

    expect(kbService.findOneForUser).toHaveBeenCalledWith('u1', 'kb1');
    expect(stageService.loadForUser).toHaveBeenCalledWith('u1', 'f1');
    expect(embedder.embed).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.knowledgeDocument.create).toHaveBeenCalledTimes(1);
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

    // best-effort 异步触发，等微任务跑完
    await new Promise((r) => setImmediate(r));
    expect(stageService.removeAfterIngest).toHaveBeenCalledWith('f1');
  });

  it('扩展名不支持（stage 是 pdf） → KnowledgeFileTypeUnsupported', async () => {
    stageService.loadForUser.mockResolvedValueOnce({
      stage: buildStage({ fileExtension: 'pdf' }),
      buffer: Buffer.from('x'),
    });
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
    expect(stageService.removeAfterIngest).not.toHaveBeenCalled();
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

  it('embedder 失败抛错 → 不进事务，stage 保留', async () => {
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
    expect(stageService.removeAfterIngest).not.toHaveBeenCalled();
  });

  it('KB 不存在 → KnowledgeBaseNotFound', async () => {
    kbService.findOneForUser.mockRejectedValueOnce(
      new BusinessException('not found', ErrorCode.KnowledgeBaseNotFound),
    );
    const service = buildService(makeEmbedder([]));

    await expect(
      service.chunkAndIngest('u1', 'missing', 'f1', { chunkType: 'default' }),
    ).rejects.toMatchObject({ message: expect.stringContaining('not found') });
    expect(stageService.loadForUser).not.toHaveBeenCalled();
  });

  it('stage 不存在 → KnowledgeUploadStageNotFound', async () => {
    stageService.loadForUser.mockRejectedValueOnce(
      new BusinessException(
        'stage not found',
        ErrorCode.KnowledgeUploadStageNotFound,
      ),
    );
    const service = buildService(makeEmbedder([]));

    try {
      await service.chunkAndIngest('u1', 'kb1', 'missing', {
        chunkType: 'default',
      });
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeUploadStageNotFound,
      );
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

  it('listChunksByDocument: 文档不存在 → KnowledgeDocumentNotFound', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce(null);
    const service = buildService(makeEmbedder([]));
    try {
      await service.listChunksByDocument('u1', 'missing');
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeDocumentNotFound,
      );
    }
  });

  it('listChunksByDocument: 用当前 schema 字段查 chunks 并映射响应', async () => {
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce(buildDoc());
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'c1', index: 0, content: 'hello' },
      { id: 'c2', index: 1, content: '你😀好' },
    ]);
    const service = buildService(makeEmbedder([]));

    const out = await service.listChunksByDocument('u1', 'doc1');
    expect(kbService.findOneForUser).toHaveBeenCalledWith('u1', 'kb1');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(out).toEqual({
      documentId: 'doc1',
      totalChunks: 2,
      list: [
        { id: 'c1', chunkIndex: 0, content: 'hello', charCount: 5 },
        { id: 'c2', chunkIndex: 1, content: '你😀好', charCount: 3 },
      ],
    });
  });
});
