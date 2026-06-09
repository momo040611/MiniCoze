import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PrismaService } from '../../../../database/prisma.service';
import { KnowledgeBaseService } from '../../bases/knowledge-base.service';
import type { Embedder } from '../../embedding/embedder.interface';
import { RetrievalService } from '../retrieval.service';

const buildKb = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'kb1',
  workspaceId: 'ws1',
  creatorId: 'u1',
  name: 'KB',
  description: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-06-06T00:00:00Z'),
  updatedAt: new Date('2026-06-06T00:00:00Z'),
  ...overrides,
});

const makeEmbedder = (vectors: number[][], dimensions = 1024): Embedder => ({
  model: 'mock-embedder',
  dimensions,
  embed: jest.fn().mockResolvedValue(vectors),
});

const buildVector = (fill = 0.1, dim = 1024) => new Array(dim).fill(fill);

describe('RetrievalService', () => {
  let prisma: {
    knowledgeChunk: { findMany: jest.Mock };
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let kbService: { findOneForUser: jest.Mock };

  const buildService = (embedder: Embedder) =>
    new RetrievalService(
      prisma as unknown as PrismaService,
      kbService as unknown as KnowledgeBaseService,
      embedder,
    );

  beforeEach(() => {
    prisma = {
      knowledgeChunk: { findMany: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn(),
    };
    kbService = {
      findOneForUser: jest.fn().mockResolvedValue(buildKb()),
    };
  });

  describe('indexChunks', () => {
    it('维度匹配 → 逐行 upsert', async () => {
      const service = buildService(makeEmbedder([]));
      await service.indexChunks(
        prisma as unknown as PrismaService,
        [
          { chunkId: 'c1', vector: buildVector(0.1) },
          { chunkId: 'c2', vector: buildVector(0.2) },
        ],
        'mock-embedder',
        1024,
      );
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
      const sql = prisma.$executeRaw.mock.calls[0][0].join('');
      expect(sql).toContain('"KnowledgeChunkVector"');
      expect(sql).toContain('ON CONFLICT ("chunkId") DO UPDATE');
      expect(sql).toContain('::vector');
    });

    it('维度不匹配 → KnowledgeVectorDimensionMismatch，未发出 SQL', async () => {
      const service = buildService(makeEmbedder([]));
      await expect(
        service.indexChunks(
          prisma as unknown as PrismaService,
          [{ chunkId: 'c1', vector: [0.1, 0.2] }],
          'mock-embedder',
          1024,
        ),
      ).rejects.toMatchObject({
        message: expect.stringContaining('vector dimension mismatch'),
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('SQL 失败 → 包装为 KnowledgeRetrievalQueryFailed', async () => {
      prisma.$executeRaw.mockRejectedValueOnce(new Error('db down'));
      const service = buildService(makeEmbedder([]));
      try {
        await service.indexChunks(
          prisma as unknown as PrismaService,
          [{ chunkId: 'c1', vector: buildVector() }],
          'mock-embedder',
          1024,
        );
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeRetrievalQueryFailed,
        );
      }
    });

    it('空 rows → 直接返回，不调 SQL', async () => {
      const service = buildService(makeEmbedder([]));
      await service.indexChunks(
        prisma as unknown as PrismaService,
        [],
        'mock-embedder',
        1024,
      );
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('indexSingleChunk', () => {
    it('happy path: 调 embedder 后 upsert 一行', async () => {
      const embedder = makeEmbedder([buildVector(0.5)]);
      const service = buildService(embedder);
      await service.indexSingleChunk('c1', 'hello');
      expect(embedder.embed).toHaveBeenCalledWith(['hello']);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('search', () => {
    const baseInput = {
      knowledgeBaseIds: ['kb1'],
      query: 'hello',
      topK: 5,
      minScore: 0,
    };

    it('happy path: 按 score 降序返回字段映射', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 'c1',
          content: 'a',
          knowledgeBaseId: 'kb1',
          documentId: 'd1',
          index: 0,
          documentName: 'demo.md',
          score: 0.9,
        },
        {
          id: 'c2',
          content: 'b',
          knowledgeBaseId: 'kb1',
          documentId: 'd1',
          index: 1,
          documentName: 'demo.md',
          score: 0.7,
        },
      ]);
      const embedder = makeEmbedder([buildVector()]);
      const service = buildService(embedder);

      const out = await service.search('u1', baseInput);

      expect(kbService.findOneForUser).toHaveBeenCalledWith('u1', 'kb1');
      expect(embedder.embed).toHaveBeenCalledWith(['hello']);
      expect(out.map((r) => r.chunkId)).toEqual(['c1', 'c2']);
      expect(out[0].score).toBe(0.9);
      expect(out[0].documentName).toBe('demo.md');
    });

    it('topK=0 → BadRequest', async () => {
      const service = buildService(makeEmbedder([]));
      await expect(
        service.search('u1', { ...baseInput, topK: 0 }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('topK'),
      });
      expect(kbService.findOneForUser).not.toHaveBeenCalled();
    });

    it('query 为空 → BadRequest', async () => {
      const service = buildService(makeEmbedder([]));
      await expect(
        service.search('u1', { ...baseInput, query: '   ' }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('query'),
      });
    });

    it('knowledgeBaseIds 为空 → BadRequest', async () => {
      const service = buildService(makeEmbedder([]));
      await expect(
        service.search('u1', { ...baseInput, knowledgeBaseIds: [] }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('knowledgeBaseIds'),
      });
    });

    it('命中 < topK → 返回实际数', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 'c1',
          content: 'a',
          knowledgeBaseId: 'kb1',
          documentId: 'd1',
          index: 0,
          documentName: 'd.md',
          score: 0.8,
        },
      ]);
      const service = buildService(makeEmbedder([buildVector()]));
      const out = await service.search('u1', { ...baseInput, topK: 5 });
      expect(out).toHaveLength(1);
    });

    it('全部 score < minScore → 返回空数组（SQL 端已过滤）', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      const service = buildService(makeEmbedder([buildVector()]));
      const out = await service.search('u1', { ...baseInput, minScore: 0.95 });
      expect(out).toEqual([]);
    });

    it('某 kbId 跨 workspace → Forbidden 透传', async () => {
      kbService.findOneForUser.mockRejectedValueOnce(
        new BusinessException('forbidden', ErrorCode.Forbidden),
      );
      const service = buildService(makeEmbedder([buildVector()]));
      try {
        await service.search('u1', baseInput);
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.Forbidden,
        );
      }
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('KB DISABLED → KnowledgeBaseInvalidStatus', async () => {
      kbService.findOneForUser.mockResolvedValueOnce(
        buildKb({ status: 'DISABLED' }),
      );
      const service = buildService(makeEmbedder([buildVector()]));
      try {
        await service.search('u1', baseInput);
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeBaseInvalidStatus,
        );
      }
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('KB ARCHIVED → KnowledgeBaseInvalidStatus', async () => {
      kbService.findOneForUser.mockResolvedValueOnce(
        buildKb({ status: 'ARCHIVED' }),
      );
      const service = buildService(makeEmbedder([buildVector()]));
      try {
        await service.search('u1', baseInput);
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeBaseInvalidStatus,
        );
      }
    });

    it('embedder 失败 → 透传 KnowledgeEmbeddingFailed', async () => {
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
      try {
        await service.search('u1', baseInput);
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeEmbeddingFailed,
        );
      }
    });

    it('$queryRaw 抛错 → 包装为 KnowledgeRetrievalQueryFailed', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('boom'));
      const service = buildService(makeEmbedder([buildVector()]));
      try {
        await service.search('u1', baseInput);
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeRetrievalQueryFailed,
        );
      }
    });
  });

  describe('reindexKnowledgeBase', () => {
    it('增量 force=false：skipped 已有向量，processed 缺失向量', async () => {
      prisma.knowledgeChunk.findMany.mockResolvedValueOnce([
        { id: 'c1', content: 'aaa' },
        { id: 'c2', content: 'bbb' },
        { id: 'c3', content: 'ccc' },
      ]);
      prisma.$queryRaw.mockResolvedValueOnce([{ chunkId: 'c1' }]);
      const embedder = makeEmbedder([buildVector(0.1), buildVector(0.2)]);
      const service = buildService(embedder);

      const out = await service.reindexKnowledgeBase('u1', 'kb1', false);

      expect(out).toEqual({
        knowledgeBaseId: 'kb1',
        processed: 2,
        skipped: 1,
        failed: 0,
      });
      expect(embedder.embed).toHaveBeenCalledWith(['bbb', 'ccc']);
      // 2 次 upsert（c2, c3）
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('force=true：先清后写全量', async () => {
      prisma.knowledgeChunk.findMany.mockResolvedValueOnce([
        { id: 'c1', content: 'a' },
        { id: 'c2', content: 'b' },
      ]);
      const embedder = makeEmbedder([buildVector(0.1), buildVector(0.2)]);
      const service = buildService(embedder);

      const out = await service.reindexKnowledgeBase('u1', 'kb1', true);

      // 1 次 DELETE + 2 次 INSERT
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
      expect(prisma.$executeRaw.mock.calls[0][0].join('')).toContain('DELETE');
      expect(out.processed).toBe(2);
      expect(out.skipped).toBe(0);
    });

    it('DISABLED 允许', async () => {
      kbService.findOneForUser.mockResolvedValueOnce(
        buildKb({ status: 'DISABLED' }),
      );
      prisma.knowledgeChunk.findMany.mockResolvedValueOnce([]);
      const service = buildService(makeEmbedder([]));
      const out = await service.reindexKnowledgeBase('u1', 'kb1', false);
      expect(out.processed).toBe(0);
    });

    it('ARCHIVED → KnowledgeBaseInvalidStatus', async () => {
      kbService.findOneForUser.mockResolvedValueOnce(
        buildKb({ status: 'ARCHIVED' }),
      );
      const service = buildService(makeEmbedder([]));
      try {
        await service.reindexKnowledgeBase('u1', 'kb1', false);
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeBaseInvalidStatus,
        );
      }
      expect(prisma.knowledgeChunk.findMany).not.toHaveBeenCalled();
    });

    it('KB 内 chunk 数 = 0 → 直接返回 0 计数，不调 embedder', async () => {
      prisma.knowledgeChunk.findMany.mockResolvedValueOnce([]);
      const embedder = makeEmbedder([]);
      const service = buildService(embedder);

      const out = await service.reindexKnowledgeBase('u1', 'kb1', false);

      expect(out).toEqual({
        knowledgeBaseId: 'kb1',
        processed: 0,
        skipped: 0,
        failed: 0,
      });
      expect(embedder.embed).not.toHaveBeenCalled();
    });

    it('增量模式全部已索引 → processed=0, skipped=N', async () => {
      prisma.knowledgeChunk.findMany.mockResolvedValueOnce([
        { id: 'c1', content: 'a' },
        { id: 'c2', content: 'b' },
      ]);
      prisma.$queryRaw.mockResolvedValueOnce([
        { chunkId: 'c1' },
        { chunkId: 'c2' },
      ]);
      const embedder = makeEmbedder([]);
      const service = buildService(embedder);

      const out = await service.reindexKnowledgeBase('u1', 'kb1', false);

      expect(out).toEqual({
        knowledgeBaseId: 'kb1',
        processed: 0,
        skipped: 2,
        failed: 0,
      });
      expect(embedder.embed).not.toHaveBeenCalled();
    });
  });
});
