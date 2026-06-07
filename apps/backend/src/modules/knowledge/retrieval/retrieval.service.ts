import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { KnowledgeBaseStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { PrismaService } from '../../../database/prisma.service';
import { KnowledgeBaseService } from '../bases/knowledge-base.service';
import {
  EMBEDDER_TOKEN,
  type Embedder,
} from '../embedding/embedder.interface';

/** 既能接 PrismaService，也能接事务里的 tx 参数。 */
export type PrismaRawExecutor = PrismaService | Prisma.TransactionClient;

export interface IndexChunkRow {
  chunkId: string;
  vector: number[];
}

export interface SearchInput {
  knowledgeBaseIds: string[];
  query: string;
  topK: number;
  minScore: number;
}

export interface RetrievedChunk {
  chunkId: string;
  knowledgeBaseId: string;
  documentId: string;
  documentName: string;
  index: number;
  content: string;
  score: number;
}

export interface ReindexResult {
  knowledgeBaseId: string;
  processed: number;
  skipped: number;
  failed: number;
}

type RawSearchRow = {
  id: string;
  content: string;
  knowledgeBaseId: string;
  documentId: string;
  index: number;
  documentName: string;
  score: number;
};

/** 把 number[] 转成 pgvector 字面量（如 `[0.1,0.2,0.3]`）。 */
function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    @Inject(EMBEDDER_TOKEN) private readonly embedder: Embedder,
  ) {}

  /**
   * 批量 upsert chunk 向量。事务内或事务外均可调（执行器由调用方传入）。
   * 维度不一致直接抛 KnowledgeVectorDimensionMismatch；调用方在事务里时由事务回滚。
   */
  async indexChunks(
    executor: PrismaRawExecutor,
    rows: IndexChunkRow[],
    embedderModel: string,
    dim: number,
  ): Promise<void> {
    if (rows.length === 0) return;

    for (const row of rows) {
      if (row.vector.length !== dim) {
        throw new BusinessException(
          `vector dimension mismatch: expected ${dim}, got ${row.vector.length} (chunkId=${row.chunkId})`,
          ErrorCode.KnowledgeVectorDimensionMismatch,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    for (const row of rows) {
      const id = randomUUID();
      const literal = toVectorLiteral(row.vector);
      try {
        await executor.$executeRaw`
          INSERT INTO "KnowledgeChunkVector" ("id", "chunkId", "embedderModel", "dim", "vector", "updatedAt")
          VALUES (${id}, ${row.chunkId}, ${embedderModel}, ${dim}, ${literal}::vector, NOW())
          ON CONFLICT ("chunkId") DO UPDATE SET
            "vector" = EXCLUDED."vector",
            "embedderModel" = EXCLUDED."embedderModel",
            "dim" = EXCLUDED."dim",
            "updatedAt" = NOW()
        `;
      } catch (error) {
        this.logger.error(
          `indexChunks failed for chunkId=${row.chunkId}: ${(error as Error).message}`,
        );
        throw new BusinessException(
          `failed to index chunk vector: ${(error as Error).message}`,
          ErrorCode.KnowledgeRetrievalQueryFailed,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  /** 单 chunk 重算并 upsert。供编辑 chunk 路径使用。 */
  async indexSingleChunk(chunkId: string, content: string): Promise<void> {
    const vectors = await this.embedder.embed([content]);
    if (vectors.length !== 1) {
      throw new BusinessException(
        `embedding count mismatch: expected 1, got ${vectors.length}`,
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }
    await this.indexChunks(
      this.prisma,
      [{ chunkId, vector: vectors[0] }],
      this.embedder.model,
      this.embedder.dimensions,
    );
  }

  /**
   * 多 KB 语义检索：
   * 1. 对每个 kbId 校验 workspace 成员资格 + KB 状态必须为 ACTIVE
   * 2. embed query
   * 3. 走 SQL 算 cosine similarity，受 topK / minScore / enabled / status 过滤
   */
  async search(
    userId: string,
    input: SearchInput,
  ): Promise<RetrievedChunk[]> {
    if (input.knowledgeBaseIds.length === 0) {
      throw new BusinessException(
        'knowledgeBaseIds must not be empty',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!input.query || input.query.trim().length === 0) {
      throw new BusinessException(
        'query must not be empty',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.topK <= 0) {
      throw new BusinessException(
        'topK must be > 0',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 鉴权 + 状态校验：任一失败即抛出。
    for (const kbId of input.knowledgeBaseIds) {
      const kb = await this.knowledgeBaseService.findOneForUser(userId, kbId);
      if (kb.status !== KnowledgeBaseStatus.ACTIVE) {
        throw new BusinessException(
          `knowledge base ${kbId} is not active (status=${kb.status})`,
          ErrorCode.KnowledgeBaseInvalidStatus,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const vectors = await this.embedder.embed([input.query]);
    if (vectors.length !== 1) {
      throw new BusinessException(
        `embedding count mismatch: expected 1, got ${vectors.length}`,
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }
    if (vectors[0].length !== this.embedder.dimensions) {
      throw new BusinessException(
        `query embedding dimension mismatch: expected ${this.embedder.dimensions}, got ${vectors[0].length}`,
        ErrorCode.KnowledgeVectorDimensionMismatch,
      );
    }
    const queryLiteral = toVectorLiteral(vectors[0]);

    let rows: RawSearchRow[];
    try {
      rows = await this.prisma.$queryRaw<RawSearchRow[]>`
        SELECT
          c."id"               AS "id",
          c."content"          AS "content",
          c."knowledgeBaseId"  AS "knowledgeBaseId",
          c."documentId"       AS "documentId",
          c."index"            AS "index",
          d."name"             AS "documentName",
          1 - (v."vector" <=> ${queryLiteral}::vector) AS "score"
        FROM "KnowledgeChunkVector" v
        JOIN "KnowledgeChunk" c    ON v."chunkId" = c."id"
        JOIN "KnowledgeBase" kb    ON c."knowledgeBaseId" = kb."id"
        JOIN "KnowledgeDocument" d ON c."documentId" = d."id"
        WHERE c."knowledgeBaseId" IN (${Prisma.join(input.knowledgeBaseIds)})
          AND c."enabled" = true
          AND kb."status" = 'ACTIVE'
          AND 1 - (v."vector" <=> ${queryLiteral}::vector) >= ${input.minScore}
        ORDER BY v."vector" <=> ${queryLiteral}::vector ASC
        LIMIT ${input.topK}
      `;
    } catch (error) {
      this.logger.error(
        `retrieval search failed: ${(error as Error).message}`,
      );
      throw new BusinessException(
        `retrieval query failed: ${(error as Error).message}`,
        ErrorCode.KnowledgeRetrievalQueryFailed,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return rows.map((row) => ({
      chunkId: row.id,
      knowledgeBaseId: row.knowledgeBaseId,
      documentId: row.documentId,
      documentName: row.documentName,
      index: row.index,
      content: row.content,
      score: typeof row.score === 'number' ? row.score : Number(row.score),
    }));
  }

  /**
   * KB 粒度回填：
   * - ARCHIVED 拒绝；ACTIVE / DISABLED 允许
   * - force=true：先清后写；否则只补缺失向量的 chunk
   * - 维度由 embedder.dimensions 决定；模型变更需手动 force=true
   */
  async reindexKnowledgeBase(
    userId: string,
    knowledgeBaseId: string,
    force: boolean,
  ): Promise<ReindexResult> {
    const kb = await this.knowledgeBaseService.findOneForUser(
      userId,
      knowledgeBaseId,
    );
    if (kb.status === KnowledgeBaseStatus.ARCHIVED) {
      throw new BusinessException(
        `archived knowledge base cannot be reindexed`,
        ErrorCode.KnowledgeBaseInvalidStatus,
        HttpStatus.BAD_REQUEST,
      );
    }

    const allChunks = await this.prisma.knowledgeChunk.findMany({
      where: { knowledgeBaseId },
      select: { id: true, content: true },
    });
    const totalChunks = allChunks.length;

    if (totalChunks === 0) {
      return { knowledgeBaseId, processed: 0, skipped: 0, failed: 0 };
    }

    let targets: { id: string; content: string }[];
    let skipped = 0;

    if (force) {
      try {
        await this.prisma.$executeRaw`
          DELETE FROM "KnowledgeChunkVector"
          WHERE "chunkId" IN (
            SELECT "id" FROM "KnowledgeChunk" WHERE "knowledgeBaseId" = ${knowledgeBaseId}
          )
        `;
      } catch (error) {
        this.logger.error(
          `reindex force-delete failed: ${(error as Error).message}`,
        );
        throw new BusinessException(
          `failed to clear vectors before reindex: ${(error as Error).message}`,
          ErrorCode.KnowledgeRetrievalQueryFailed,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      targets = allChunks;
    } else {
      const existing = await this.prisma.$queryRaw<{ chunkId: string }[]>`
        SELECT v."chunkId" AS "chunkId"
        FROM "KnowledgeChunkVector" v
        JOIN "KnowledgeChunk" c ON v."chunkId" = c."id"
        WHERE c."knowledgeBaseId" = ${knowledgeBaseId}
      `;
      const existingIds = new Set(existing.map((row) => row.chunkId));
      targets = allChunks.filter((c) => !existingIds.has(c.id));
      skipped = totalChunks - targets.length;
    }

    if (targets.length === 0) {
      return { knowledgeBaseId, processed: 0, skipped, failed: 0 };
    }

    let processed = 0;
    try {
      const vectors = await this.embedder.embed(
        targets.map((c) => c.content),
      );
      if (vectors.length !== targets.length) {
        throw new BusinessException(
          `embedding count mismatch: expected ${targets.length}, got ${vectors.length}`,
          ErrorCode.KnowledgeEmbeddingFailed,
        );
      }
      const rows: IndexChunkRow[] = targets.map((c, i) => ({
        chunkId: c.id,
        vector: vectors[i],
      }));
      await this.indexChunks(
        this.prisma,
        rows,
        this.embedder.model,
        this.embedder.dimensions,
      );
      processed = rows.length;
    } catch (error) {
      throw error instanceof BusinessException
        ? error
        : new BusinessException(
            `reindex failed: ${(error as Error).message}`,
            ErrorCode.KnowledgeEmbeddingFailed,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
    }

    return { knowledgeBaseId, processed, skipped, failed: 0 };
  }
}
