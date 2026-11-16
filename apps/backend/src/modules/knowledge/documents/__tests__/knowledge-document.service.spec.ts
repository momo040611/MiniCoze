import { FilePurpose, FileStatus, FileVisibility } from '@prisma/client';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PrismaService } from '../../../../database/prisma.service';
import { FileService } from '../../../file/file.service';
import { KnowledgeBaseService } from '../../bases/knowledge-base.service';
import { DocumentParserService } from '../../parsing/document-parser.service';
import type { Embedder } from '../../embedding/embedder.interface';
import { RetrievalService } from '../../retrieval/retrieval.service';
import { DocumentTaskQueue } from '../document-task-queue';
import { KnowledgeDocumentService } from '../knowledge-document.service';

// 测试用队列替身：记录入队任务，测试里手动 flush 执行（可断言后台流水线）。
class FakeQueue {
  tasks: Array<() => Promise<void>> = [];
  enqueue(task: () => Promise<void>): void {
    this.tasks.push(task);
  }
  async flush(): Promise<void> {
    while (this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (task) {
        await task();
      }
    }
  }
}

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
  errorMessage: null,
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
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    knowledgeChunk: {
      findUnique: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let kbService: { findOneForUser: jest.Mock };
  let fileService: {
    getReadyFileForUser: jest.Mock;
    getFileBufferForInternal: jest.Mock;
  };
  let retrievalService: {
    indexChunks: jest.Mock;
    indexSingleChunk: jest.Mock;
  };
  let txMock: {
    $executeRaw: jest.Mock;
  };

  const buildService = (embedder: Embedder) =>
    new KnowledgeDocumentService(
      prisma as unknown as PrismaService,
      kbService as unknown as KnowledgeBaseService,
      fileService as unknown as FileService,
      new DocumentParserService(),
      queue as unknown as DocumentTaskQueue,
      embedder,
      retrievalService as unknown as RetrievalService,
    );

  let queue: FakeQueue;

  beforeEach(() => {
    queue = new FakeQueue();
    txMock = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma = {
      knowledgeDocument: {
        findUnique: jest.fn().mockResolvedValue(null),
        // 异步化后：立即返回时文档恒为 PROCESSING（流水线在后台队列里）
        findUniqueOrThrow: jest
          .fn()
          .mockImplementation(async () => buildDoc({ status: 'PROCESSING' })),
        findMany: jest.fn(),
        create: jest.fn().mockImplementation(async ({ data }) => buildDoc({ ...data })),
        update: jest.fn().mockImplementation(async ({ data }) => buildDoc({ ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn(),
      },
      knowledgeChunk: {
        findUnique: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
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
      indexSingleChunk: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('chunkAndIngest（状态机流水线）', () => {
    it('happy path: 立即返回 PROCESSING 文档 → 后台队列推进到 READY + chunks 入库', async () => {
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

      // 1. 先落 PROCESSING 文档行，且请求立即返回（流水线尚未执行）
      expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            knowledgeBaseId: 'kb1',
            fileId: 'f1',
            status: 'PROCESSING',
          }),
        }),
      );
      expect(out.document.id).toBe('doc1');
      expect(out.document.status).toBe('PROCESSING');
      expect(out.chunkSummary).toBeNull();
      expect(prisma.$transaction).not.toHaveBeenCalled();

      // 2. 后台流水线推进：PARSED → CHUNKED → EMBEDDING → READY
      await queue.flush();

      const statusCalls = prisma.knowledgeDocument.update.mock.calls
        .map((call) => (call[0] as { data: { status?: string } }).data.status)
        .filter(Boolean);
      expect(statusCalls).toEqual(['PARSED', 'CHUNKED', 'EMBEDDING', 'READY']);

      // 3. CHUNKED 阶段写入切分元数据
      const chunkedCall = prisma.knowledgeDocument.update.mock.calls.find(
        (call) => (call[0] as { data: { status?: string } }).data.status === 'CHUNKED',
      );
      expect((chunkedCall![0] as { data: Record<string, unknown> }).data).toMatchObject({
        chunkCount: 1,
        chunkType: 'default',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txMock.$executeRaw).toHaveBeenCalledTimes(1);

      const insertSql = txMock.$executeRaw.mock.calls[0][0].join('');
      expect(insertSql).toContain('"documentId"');
      expect(insertSql).toContain('"knowledgeBaseId"');
      expect(insertSql).toContain('"workspaceId"');
      expect(insertSql).toContain('"content"');
      expect(insertSql).toContain('"index"');
      expect(insertSql).toContain('"vectorId"');
      expect(insertSql).not.toContain('"chunkIndex"');

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

    it('onModuleInit: 启动时把非终态文档回收为 FAILED', async () => {
      const service = buildService(makeEmbedder([]));
      await service.onModuleInit();
      expect(prisma.knowledgeDocument.updateMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['PROCESSING', 'PARSED', 'CHUNKED', 'EMBEDDING'],
          },
        },
        data: {
          status: 'FAILED',
          errorMessage: '服务重启导致处理中断，请点击重新处理重试',
        },
      });
    });

    it('Unit 4: indexChunks 收到的 chunkId 与 INSERT SQL 用的 chunkId 一致', async () => {
      const embedder = makeEmbedder([new Array(1024).fill(0.1)]);
      const service = buildService(embedder);

      await service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' });
      await queue.flush();

      const insertParams = txMock.$executeRaw.mock.calls[0].slice(1);
      const insertedChunkId = insertParams[0];
      const indexedChunkId =
        retrievalService.indexChunks.mock.calls[0][1][0].chunkId;
      expect(insertedChunkId).toBe(indexedChunkId);
    });

    it('indexChunks 抛维度异常 → 后台任务把文档置 FAILED + errorMessage（请求不报错）', async () => {
      const embedder = makeEmbedder([new Array(1024).fill(0.1)]);
      retrievalService.indexChunks.mockRejectedValueOnce(
        new BusinessException(
          'dim mismatch',
          ErrorCode.KnowledgeVectorDimensionMismatch,
        ),
      );
      const service = buildService(embedder);

      const out = await service.chunkAndIngest('u1', 'kb1', 'f1', {
        chunkType: 'default',
      });
      // 异步化后请求立即成功返回，失败在后台被捕获
      expect(out.document.status).toBe('PROCESSING');

      await queue.flush();

      const failedCall = prisma.knowledgeDocument.update.mock.calls.find(
        (call) => (call[0] as { data: { status?: string } }).data.status === 'FAILED',
      );
      expect(failedCall).toBeDefined();
      expect(
        (failedCall![0] as { data: { errorMessage?: string } }).data.errorMessage,
      ).toContain('dim mismatch');
    });

    it('embedder 失败 → 后台置 FAILED，不进事务', async () => {
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

      await service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' });
      await queue.flush();

      expect(prisma.$transaction).not.toHaveBeenCalled();
      const failedCall = prisma.knowledgeDocument.update.mock.calls.find(
        (call) => (call[0] as { data: { status?: string } }).data.status === 'FAILED',
      );
      expect(failedCall).toBeDefined();
    });

    it('同 KB 同 fileId 已有文档 → 409 冲突提示', async () => {
      prisma.knowledgeDocument.findUnique.mockResolvedValueOnce(
        buildDoc({ id: 'old-doc' }),
      );
      const service = buildService(makeEmbedder([]));

      await expect(
        service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('已上传'),
      });
      expect(prisma.knowledgeDocument.create).not.toHaveBeenCalled();
    });

    it('旧格式 .doc → KnowledgeFileTypeUnsupported 并提示转换', async () => {
      fileService.getReadyFileForUser.mockResolvedValueOnce(
        buildFileAsset({ originalName: 'demo.doc', extension: '.doc' }),
      );
      const service = buildService(makeEmbedder([]));

      await expect(
        service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('.doc'),
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('pdf 文件损坏 → 后台解析失败置 FAILED（不再一刀切拒收 pdf）', async () => {
      fileService.getReadyFileForUser.mockResolvedValueOnce(
        buildFileAsset({ originalName: 'demo.pdf', extension: '.pdf' }),
      );
      fileService.getFileBufferForInternal.mockResolvedValue(
        Buffer.from('not a real pdf'),
      );
      const service = buildService(makeEmbedder([]));

      await service.chunkAndIngest('u1', 'kb1', 'f1', { chunkType: 'default' });
      await queue.flush();

      const failedCall = prisma.knowledgeDocument.update.mock.calls.find(
        (call) => (call[0] as { data: { status?: string } }).data.status === 'FAILED',
      );
      expect(failedCall).toBeDefined();
      expect(
        (failedCall![0] as { data: { errorMessage?: string } }).data.errorMessage,
      ).toContain('PDF 解析失败');
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

    it('KB 不存在 → KnowledgeBaseNotFound，且不加载文件', async () => {
      kbService.findOneForUser.mockRejectedValueOnce(
        new BusinessException('not found', ErrorCode.KnowledgeBaseNotFound),
      );
      const service = buildService(makeEmbedder([]));

      await expect(
        service.chunkAndIngest('u1', 'missing', 'f1', { chunkType: 'default' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('not found') });
      expect(fileService.getReadyFileForUser).not.toHaveBeenCalled();
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
  });

  describe('reprocess', () => {
    const failedConfig = { chunkType: 'default' };

    it('FAILED 文档 → 清旧 chunks → 后台重跑流水线 → READY', async () => {
      prisma.knowledgeDocument.findUnique.mockResolvedValue(
        buildDoc({
          status: 'FAILED',
          errorMessage: 'embedding down',
          chunkConfig: failedConfig,
        }),
      );
      const embedder = makeEmbedder([new Array(1024).fill(0.1)]);
      const service = buildService(embedder);

      const out = await service.reprocess('u1', 'doc1');

      expect(prisma.knowledgeChunk.deleteMany).toHaveBeenCalledWith({
        where: { documentId: 'doc1' },
      });
      // 立即返回 PROCESSING
      expect(out.document.status).toBe('PROCESSING');

      await queue.flush();

      expect(embedder.embed).toHaveBeenCalledTimes(1);

      const statusCalls = prisma.knowledgeDocument.update.mock.calls
        .map((call) => (call[0] as { data: { status?: string } }).data.status)
        .filter(Boolean);
      expect(statusCalls).toEqual(['PROCESSING', 'PARSED', 'CHUNKED', 'EMBEDDING', 'READY']);
    });

    it('PROCESSING 文档 → 拒绝重试', async () => {
      prisma.knowledgeDocument.findUnique.mockResolvedValueOnce(
        buildDoc({ status: 'PROCESSING' }),
      );
      const service = buildService(makeEmbedder([]));

      await expect(service.reprocess('u1', 'doc1')).rejects.toMatchObject({
        message: expect.stringContaining('正在处理'),
      });
      expect(prisma.knowledgeChunk.deleteMany).not.toHaveBeenCalled();
    });

    it('文档不存在 → KnowledgeDocumentNotFound', async () => {
      prisma.knowledgeDocument.findUnique.mockResolvedValueOnce(null);
      const service = buildService(makeEmbedder([]));

      try {
        await service.reprocess('u1', 'missing');
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeDocumentNotFound,
        );
      }
    });
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

  it('listByKnowledgeBase: 响应包含 chunkConfig 与 status（用于回显）', async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValueOnce([
      buildDoc({
        chunkConfig: { chunkType: 'custom', chunkSize: 450, overlap: 10 },
        status: 'READY',
      }),
    ]);
    const service = buildService(makeEmbedder([]));
    const out = await service.listByKnowledgeBase('u1', 'kb1');
    expect(out[0].chunkConfig).toEqual({
      chunkType: 'custom',
      chunkSize: 450,
      overlap: 10,
    });
    expect(out[0].status).toBe('READY');
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

  describe('updateChunk', () => {
    const existing = {
      id: 'chunk1',
      documentId: 'doc1',
      knowledgeBaseId: 'kb1',
      workspaceId: 'ws1',
      content: 'old content',
      index: 0,
      tokenCount: 0,
      enabled: true,
      metadata: null,
      vectorId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      prisma.knowledgeDocument.findUnique.mockResolvedValue(buildDoc());
      prisma.knowledgeChunk.findUnique.mockResolvedValue(existing);
    });

    it('内容变化 → update DB + 调 indexSingleChunk(新内容)', async () => {
      prisma.knowledgeChunk.update.mockResolvedValueOnce({
        ...existing,
        content: 'new content',
      });
      const service = buildService(makeEmbedder([]));

      const out = await service.updateChunk('u1', 'doc1', 0, 'new content');

      expect(prisma.knowledgeChunk.update).toHaveBeenCalledWith({
        where: { id: 'chunk1' },
        data: { content: 'new content' },
      });
      expect(retrievalService.indexSingleChunk).toHaveBeenCalledWith(
        'chunk1',
        'new content',
      );
      expect(out.content).toBe('new content');
    });

    it('内容相同 → 不调 update、不调 indexSingleChunk，直接返原数据', async () => {
      const service = buildService(makeEmbedder([]));

      const out = await service.updateChunk('u1', 'doc1', 0, 'old content');

      expect(prisma.knowledgeChunk.update).not.toHaveBeenCalled();
      expect(retrievalService.indexSingleChunk).not.toHaveBeenCalled();
      expect(out.content).toBe('old content');
      expect(out.id).toBe('chunk1');
    });

    it('indexSingleChunk 抛 KnowledgeEmbeddingFailed → 透传，但 chunk 已写（不回滚）', async () => {
      prisma.knowledgeChunk.update.mockResolvedValueOnce({
        ...existing,
        content: 'new content',
      });
      retrievalService.indexSingleChunk.mockRejectedValueOnce(
        new BusinessException('embed down', ErrorCode.KnowledgeEmbeddingFailed),
      );
      const service = buildService(makeEmbedder([]));

      try {
        await service.updateChunk('u1', 'doc1', 0, 'new content');
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeEmbeddingFailed,
        );
      }
      // chunk update 已发生（不回滚 — 已记录折中）
      expect(prisma.knowledgeChunk.update).toHaveBeenCalledTimes(1);
    });
  });
});
