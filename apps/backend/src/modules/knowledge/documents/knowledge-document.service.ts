import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { FilePurpose, Prisma, type FileAsset, type KnowledgeDocument } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../../common/utils/date-time';
import { PrismaService } from '../../../database/prisma.service';
import { FileService } from '../../file/file.service';
import { KnowledgeBaseService } from '../bases/knowledge-base.service';
import { chunk } from '../chunking/chunk';
import type { ChunkConfig } from '../chunking/types';
import { ChunkConfigDto } from '../dto/chunk-config.dto';
import {
  EMBEDDER_TOKEN,
  type Embedder,
} from '../embedding/embedder.interface';
import { RetrievalService } from '../retrieval/retrieval.service';
import { DocumentChunksPaginatedResponseDto } from './dto/document-chunks-response.dto';
import {
  UploadDocumentResponseDto,
  UploadedDocumentDto,
} from './dto/upload-document-response.dto';

type KnowledgeDocumentWithFile = KnowledgeDocument & { file: FileAsset };

type KnowledgeChunkRow = {
  id: string;
  index: number;
  content: string;
  enabled: boolean;
};

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly fileService: FileService,
    @Inject(EMBEDDER_TOKEN) private readonly embedder: Embedder,
    private readonly retrievalService: RetrievalService,
  ) {}

  /**
   * 核心流程：从 FileAsset 加载文件 → 切分 → 向量化（事务外）
   * → 单事务写入 document + chunks。文件资产保留。
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

    const { fileAsset, buffer } = await this.loadKnowledgeDocumentFile(
      userId,
      fileId,
    );

    const ext = this.extractExtension(fileAsset.originalName);
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
          workspaceId: kb.workspaceId,
          fileId,
          creatorId: userId,
          name: fileAsset.originalName,
          chunkType: meta.chunkType,
          chunkConfig: config as unknown as Prisma.InputJsonValue,
          chunkCount: meta.totalChunks,
          totalChars: meta.totalChars,
        },
        include: { file: true },
      });

      // 在 JS 侧预生成 chunkId，让 chunk 插入与向量 upsert 共享同一组主键。
      const chunkIds = chunks.map(() => randomUUID());

      // chunk insert 使用当前 schema 字段：documentId, knowledgeBaseId, workspaceId, content, index, vectorId, updatedAt
      // tokenCount 使用 DB 默认 0，metadata 省略，createdAt 使用 DB 默认
      // vectorId 保持 NULL（向量持久化在 KnowledgeChunkVector 表，由下方 indexChunks 写入）
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        await tx.$executeRaw`
          INSERT INTO "KnowledgeChunk" ("id", "documentId", "knowledgeBaseId", "workspaceId", "content", "index", "vectorId", "updatedAt")
          VALUES (
            ${chunkIds[i]},
            ${doc.id},
            ${kb.id},
            ${kb.workspaceId},
            ${c.content},
            ${c.index},
            NULL,
            NOW()
          )
        `;
      }

      // 把向量写入 KnowledgeChunkVector。维度不一致或 SQL 异常会抛错，整事务回滚。
      await this.retrievalService.indexChunks(
        tx,
        chunks.map((_, i) => ({ chunkId: chunkIds[i], vector: vectors[i] })),
        this.embedder.model,
        this.embedder.dimensions,
      );

      return doc;
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
      include: { file: true },
    });
    return list.map((d) => this.toDocumentResponse(d));
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
      include: { file: true },
    });
    return this.toDocumentResponse(removed);
  }

  async listChunksByDocumentPaginated(
    userId: string,
    documentId: string,
    page: number,
    pageSize: number,
  ): Promise<DocumentChunksPaginatedResponseDto> {
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
    await this.knowledgeBaseService.findOneForUser(
      userId,
      doc.knowledgeBaseId,
    );

    const skip = (page - 1) * pageSize;

    const [total, rows] = await Promise.all([
      this.prisma.knowledgeChunk.count({ where: { documentId } }),
      this.prisma.knowledgeChunk.findMany({
        where: { documentId },
        orderBy: { index: 'asc' },
        skip,
        take: pageSize,
        select: { id: true, index: true, content: true, enabled: true },
      }),
    ]);

    return {
      documentId,
      total,
      page,
      pageSize,
      list: rows.map((row) => ({
        id: row.id,
        chunkIndex: row.index,
        content: row.content,
        charCount: Array.from(row.content).length,
        enabled: row.enabled,
      })),
    };
  }

  async updateChunk(
    userId: string,
    documentId: string,
    index: number,
    content: string,
  ) {
    const chunk = await this.findChunkForUser(userId, documentId, index);

    // 内容未变 → 不动 DB、不调 embedder（节省一次外部 API 往返）
    if (chunk.content === content) {
      return {
        id: chunk.id,
        chunkIndex: chunk.index,
        content: chunk.content,
        charCount: Array.from(chunk.content).length,
        enabled: chunk.enabled,
      };
    }

    const updated = await this.prisma.knowledgeChunk.update({
      where: { id: chunk.id },
      data: { content },
    });

    // 注意：chunk.update 与 indexSingleChunk 不在同一事务（embedding 是外部 HTTP 调用）。
    // 若 embedding 失败：chunk 内容已落 DB，但向量仍指向旧文本 → 抛错让调用方决定重试。
    // 这是已记录的折中（plan Unit 5 §Approach）；未来切异步队列后可收敛。
    await this.retrievalService.indexSingleChunk(updated.id, content);

    return {
      id: updated.id,
      chunkIndex: updated.index,
      content: updated.content,
      charCount: Array.from(updated.content).length,
      enabled: updated.enabled,
    };
  }

  async deleteChunk(
    userId: string,
    documentId: string,
    index: number,
  ) {
    const chunk = await this.findChunkForUser(userId, documentId, index);
    await this.prisma.knowledgeChunk.delete({ where: { id: chunk.id } });
    await this.prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { chunkCount: { decrement: 1 } },
    });
    return { documentId, index };
  }

  async toggleChunk(
    userId: string,
    documentId: string,
    index: number,
    enabled: boolean,
  ) {
    const chunk = await this.findChunkForUser(userId, documentId, index);
    const updated = await this.prisma.knowledgeChunk.update({
      where: { id: chunk.id },
      data: { enabled },
    });
    return {
      id: updated.id,
      chunkIndex: updated.index,
      content: updated.content,
      charCount: Array.from(updated.content).length,
      enabled: updated.enabled,
    };
  }

  private async findChunkForUser(
    userId: string,
    documentId: string,
    index: number,
  ) {
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
    await this.knowledgeBaseService.findOneForUser(userId, doc.knowledgeBaseId);

    const chunk = await this.prisma.knowledgeChunk.findUnique({
      where: { documentId_index: { documentId, index } },
    });
    if (!chunk) {
      throw new BusinessException(
        '切片不存在',
        ErrorCode.KnowledgeChunkNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    return chunk;
  }

  private async loadKnowledgeDocumentFile(userId: string, fileId: string) {
    const currentUser = {
      id: userId,
      email: '',
      username: '',
    };
    const fileAsset = await this.fileService.getReadyFileForUser(
      fileId,
      currentUser,
    );

    if (fileAsset.purpose !== FilePurpose.KNOWLEDGE_DOCUMENT) {
      throw new BusinessException(
        '文件用途不是知识库文档',
        ErrorCode.KnowledgeFileTypeUnsupported,
        HttpStatus.BAD_REQUEST,
      );
    }

    const buffer = await this.fileService.getFileBufferForInternal(fileId);
    return { fileAsset, buffer };
  }

  private extractExtension(filename: string): string {
    const idx = filename.lastIndexOf('.');
    if (idx === -1 || idx === filename.length - 1) {
      throw new BusinessException(
        'file has no extension',
        ErrorCode.KnowledgeFileTypeUnsupported,
      );
    }
    return filename.slice(idx + 1).toLowerCase();
  }

  private toDocumentResponse(
    doc: KnowledgeDocumentWithFile,
  ): UploadedDocumentDto {
    return {
      id: doc.id,
      knowledgeBaseId: doc.knowledgeBaseId,
      originalName: doc.file.originalName,
      fileExtension: doc.file.extension ?? '',
      fileSize: doc.file.size,
      chunkType: doc.chunkType ?? '',
      chunkConfig: (doc.chunkConfig ?? {}) as unknown as Record<string, unknown>,
      totalChunks: doc.chunkCount,
      totalChars: doc.totalChars,
      createdAt: formatShanghaiDateTime(doc.createdAt),
    };
  }
}
