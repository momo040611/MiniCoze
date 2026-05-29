import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, type KnowledgeDocument } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../../common/utils/date-time';
import { PrismaService } from '../../../database/prisma.service';
import { KnowledgeBaseService } from '../bases/knowledge-base.service';
import { chunk } from '../chunking/chunk';
import type { ChunkConfig } from '../chunking/types';
import { ChunkConfigDto } from '../dto/chunk-config.dto';
import {
  EMBEDDER_TOKEN,
  type Embedder,
} from '../embedding/embedder.interface';
import { UploadStageService } from '../uploads/upload-stage.service';
import {
  UploadDocumentResponseDto,
  UploadedDocumentDto,
} from './dto/upload-document-response.dto';
import {
  DocumentChunkItemDto,
  DocumentChunksResponseDto,
} from './dto/document-chunks-response.dto';

@Injectable()
export class KnowledgeDocumentService {
  private readonly logger = new Logger(KnowledgeDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly uploadStageService: UploadStageService,
    @Inject(EMBEDDER_TOKEN) private readonly embedder: Embedder,
  ) {}

  /**
   * 核心流程：从 stage 加载文件 → 切分 → 维度校验 → 向量化（事务外）
   * → 单事务写入 document + chunks → 事务后 best-effort 清理 stage。
   */
  async chunkAndIngest(
    userId: string,
    knowledgeBaseId: string,
    fileId: string,
    configRawObject: unknown,
  ): Promise<UploadDocumentResponseDto> {
    const kb = await this.knowledgeBaseService.findOneForUser(
      userId,
      knowledgeBaseId,
    );

    // 当前 embedder 与 KB 固化维度不一致 → 立即失败，避免错误向量入库。
    if (this.embedder.dimensions !== kb.embeddingDim) {
      throw new BusinessException(
        `embedder dimension (${this.embedder.dimensions}) does not match KnowledgeBase.embeddingDim (${kb.embeddingDim})`,
        ErrorCode.KnowledgeEmbeddingDimMismatch,
      );
    }

    const { stage, buffer } = await this.uploadStageService.loadForUser(
      userId,
      fileId,
    );

    const ext = stage.fileExtension;
    const config: ChunkConfig = ChunkConfigDto.fromJsonString(
      JSON.stringify(configRawObject),
    );
    const text = buffer.toString('utf8');
    const { meta, chunks } = chunk(text, ext, config);

    // 切分后无内容（极小文档全空白）→ 直接报错避免落空 document。
    if (chunks.length === 0) {
      throw new BusinessException(
        'document produced no chunks',
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }

    // 事务外做耗时的 embedding 调用。失败则什么也没写。
    const vectors = await this.embedder.embed(chunks.map((c) => c.content));
    if (vectors.length !== chunks.length) {
      throw new BusinessException(
        `embedding count mismatch: chunks=${chunks.length}, vectors=${vectors.length}`,
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }

    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.knowledgeDocument.create({
        data: {
          knowledgeBaseId,
          originalName: stage.originalName,
          fileExtension: meta.fileExtension,
          fileSize: stage.fileSize,
          chunkType: meta.chunkType,
          chunkConfig: config as unknown as Prisma.InputJsonValue,
          totalChunks: meta.totalChunks,
          totalChars: meta.totalChars,
        },
      });

      // pgvector 字段无法通过 Prisma client 写入，逐条 raw insert。
      // 事务内执行可保证原子性；百级 chunks 单文档延迟可接受。
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const v = vectors[i];
        const chunkId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "KnowledgeChunk" ("id", "documentId", "chunkIndex", "content", "charCount", "embedding", "createdAt")
          VALUES (
            ${chunkId},
            ${doc.id},
            ${c.index},
            ${c.content},
            ${c.charCount},
            ${this.toVectorLiteral(v)}::vector,
            NOW()
          )
        `;
      }

      return doc;
    });

    // 入库成功 → best-effort 清理 stage。失败仅 log，由 GC 兜底。
    this.uploadStageService.removeAfterIngest(fileId).catch((e: unknown) => {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(`removeAfterIngest unexpected failure: ${reason}`);
    });

    return {
      document: this.toDocumentResponse(document),
      chunkSummary: {
        totalChunks: meta.totalChunks,
        totalChars: meta.totalChars,
      },
    };
  }

  async listByKnowledgeBase(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<UploadedDocumentDto[]> {
    await this.knowledgeBaseService.findOneForUser(userId, knowledgeBaseId);
    const list = await this.prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((d) => this.toDocumentResponse(d));
  }

  /**
   * 列出某文档的所有 chunks（不含 embedding 向量）。
   * 用于前端"按知识库 id 查看历史文档切分内容"的回放能力。
   *
   * 注意：embedding 字段是 pgvector 类型，Prisma client 读它需要扩展支持，
   * 这里用 raw SQL 显式只 select 需要的列，避免触碰 vector 类型。
   */
  async listChunksByDocument(
    userId: string,
    documentId: string,
  ): Promise<DocumentChunksResponseDto> {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new BusinessException(
        '文档不存在',
        ErrorCode.KnowledgeDocumentNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    // 校验该文档所属 KB 的成员资格
    await this.knowledgeBaseService.findOneForUser(
      userId,
      doc.knowledgeBaseId,
    );

    const rows = await this.prisma.$queryRaw<DocumentChunkItemDto[]>`
      SELECT "id", "chunkIndex", "content", "charCount"
      FROM "KnowledgeChunk"
      WHERE "documentId" = ${documentId}
      ORDER BY "chunkIndex" ASC
    `;

    return {
      documentId,
      totalChunks: rows.length,
      list: rows,
    };
  }

  async remove(
    userId: string,
    documentId: string,
  ): Promise<UploadedDocumentDto> {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new BusinessException(
        '文档不存在',
        ErrorCode.KnowledgeDocumentNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    // 校验该文档所属 KB 的 workspace 成员资格
    await this.knowledgeBaseService.findOneForUser(
      userId,
      doc.knowledgeBaseId,
    );

    const removed = await this.prisma.knowledgeDocument.delete({
      where: { id: documentId },
    });
    return this.toDocumentResponse(removed);
  }

  /** 把 number[] 转成 pgvector 接受的字面量字符串：'[0.1,0.2,...]'。 */
  private toVectorLiteral(v: number[]): string {
    return `[${v.join(',')}]`;
  }

  private toDocumentResponse(doc: KnowledgeDocument): UploadedDocumentDto {
    return {
      id: doc.id,
      knowledgeBaseId: doc.knowledgeBaseId,
      originalName: doc.originalName,
      fileExtension: doc.fileExtension,
      fileSize: doc.fileSize,
      chunkType: doc.chunkType,
      chunkConfig: doc.chunkConfig as unknown as Record<string, unknown>,
      totalChunks: doc.totalChunks,
      totalChars: doc.totalChars,
      createdAt: formatShanghaiDateTime(doc.createdAt),
    };
  }
}
