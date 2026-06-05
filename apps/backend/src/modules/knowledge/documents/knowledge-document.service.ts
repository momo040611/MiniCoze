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
import { DocumentChunksResponseDto } from './dto/document-chunks-response.dto';
import {
  UploadDocumentResponseDto,
  UploadedDocumentDto,
} from './dto/upload-document-response.dto';

type KnowledgeDocumentWithFile = KnowledgeDocument & { file: FileAsset };

type KnowledgeChunkRow = {
  id: string;
  index: number;
  content: string;
};

@Injectable()
export class KnowledgeDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly fileService: FileService,
    @Inject(EMBEDDER_TOKEN) private readonly embedder: Embedder,
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

      // chunk insert 使用当前 schema 字段：documentId, knowledgeBaseId, workspaceId, content, index, vectorId, updatedAt
      // tokenCount 使用 DB 默认 0，metadata 省略，createdAt 使用 DB 默认
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const chunkId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO "KnowledgeChunk" ("id", "documentId", "knowledgeBaseId", "workspaceId", "content", "index", "vectorId", "updatedAt")
          VALUES (
            ${chunkId},
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

  /**
   * 列出某文档的所有 chunks（不含 embedding 向量）。
   * 用于前端"按知识库 id 查看历史文档切分内容"的回放能力。
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

    const rows = await this.prisma.$queryRaw<KnowledgeChunkRow[]>`
      SELECT "id", "index", "content"
      FROM "KnowledgeChunk"
      WHERE "documentId" = ${documentId}
      ORDER BY "index" ASC
    `;

    return {
      documentId,
      totalChunks: rows.length,
      list: rows.map((row) => ({
        id: row.id,
        chunkIndex: row.index,
        content: row.content,
        charCount: Array.from(row.content).length,
      })),
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
      include: { file: true },
    });
    return this.toDocumentResponse(removed);
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
