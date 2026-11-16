import {
  OnModuleInit,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  FilePurpose,
  KnowledgeDocumentStatus,
  Prisma,
  type FileAsset,
  type KnowledgeDocument,
} from '@prisma/client';
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
import { DocumentTaskQueue } from './document-task-queue';
import { EMBEDDER_TOKEN, type Embedder } from '../embedding/embedder.interface';
import {
  DocumentParserService,
} from '../parsing/document-parser.service';
import { RetrievalService } from '../retrieval/retrieval.service';
import { DocumentChunksPaginatedResponseDto } from './dto/document-chunks-response.dto';
import {
  UploadDocumentResponseDto,
  UploadedDocumentDto,
} from './dto/upload-document-response.dto';

type KnowledgeDocumentWithFile = KnowledgeDocument & { file: FileAsset };

@Injectable()
export class KnowledgeDocumentService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly fileService: FileService,
    private readonly documentParser: DocumentParserService,
    private readonly taskQueue: DocumentTaskQueue,
    @Inject(EMBEDDER_TOKEN) private readonly embedder: Embedder,
    private readonly retrievalService: RetrievalService,
  ) {}

  /**
   * 进程启动时回收中断文档：上次运行中处于非终态的文档不可能再推进，
   * 统一标记 FAILED，让用户可通过 reprocess 重试。
   */
  async onModuleInit(): Promise<void> {
    const result = await this.prisma.knowledgeDocument.updateMany({
      where: {
        status: {
          in: [
            KnowledgeDocumentStatus.PROCESSING,
            KnowledgeDocumentStatus.PARSED,
            KnowledgeDocumentStatus.CHUNKED,
            KnowledgeDocumentStatus.EMBEDDING,
          ],
        },
      },
      data: {
        status: KnowledgeDocumentStatus.FAILED,
        errorMessage: '服务重启导致处理中断，请点击重新处理重试',
      },
    });
    if (result.count > 0) {
      this.logger.warn(`启动时回收中断文档 ${result.count} 条 → FAILED`);
    }
  }

  /**
   * 上传入口（异步化）：完成校验后立即落文档行（PROCESSING）并返回，
   * 解析/切分/向量化流水线放入进程内队列后台执行。
   * 大文档不再阻塞 HTTP 请求；失败由后台任务标记 FAILED，可重试。
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

    const fileAsset = await this.fileService.getReadyFileForUser(fileId, {
      id: userId,
      email: '',
      username: '',
    });
    if (fileAsset.purpose !== FilePurpose.KNOWLEDGE_DOCUMENT) {
      throw new BusinessException(
        '文件用途不是知识库文档',
        ErrorCode.KnowledgeFileTypeUnsupported,
        HttpStatus.BAD_REQUEST,
      );
    }
    const ext = this.extractExtension(fileAsset.originalName);
    this.ensureParsableExtension(ext);

    // 与已有文档同 KB 同文件：提示先删除旧文档（reprocess 可重试失败文档）。
    const existing = await this.prisma.knowledgeDocument.findUnique({
      where: { knowledgeBaseId_fileId: { knowledgeBaseId, fileId } },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new BusinessException(
        '该文件已上传到此知识库，请先删除旧文档或对失败文档使用重新处理',
        ErrorCode.KnowledgeDocumentNotFound,
        HttpStatus.CONFLICT,
      );
    }

    const config: ChunkConfig = ChunkConfigDto.fromJsonString(
      JSON.stringify(configRawObject),
    );

    // 1. 先创建文档行，前端立即可见（PROCESSING），请求立即返回。
    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId,
        workspaceId: kb.workspaceId,
        fileId,
        creatorId: userId,
        name: fileAsset.originalName,
        status: KnowledgeDocumentStatus.PROCESSING,
      },
    });

    // 2. 流水线入队：buffer 在任务内按需加载，避免常驻内存。
    this.taskQueue.enqueue(async () => {
      try {
        const buffer = await this.fileService.getFileBufferForInternal(fileId);
        await this.runIngestPipeline(doc.id, buffer, ext, config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `文档 ${doc.id} 后台处理失败: ${message.slice(0, 500)}`,
        );
        await this.prisma.knowledgeDocument
          .update({
            where: { id: doc.id },
            data: {
              status: KnowledgeDocumentStatus.FAILED,
              errorMessage: message.slice(0, 2000),
            },
          })
          .catch(() => undefined);
      }
    });

    const withFile = await this.prisma.knowledgeDocument.findUniqueOrThrow({
      where: { id: doc.id },
      include: { file: true },
    });
    return {
      document: this.toDocumentResponse(withFile),
      chunkSummary: null,
    };
  }

  /**
   * 重试/重处理失败文档（异步化）：清掉旧 chunks，按原配置重新排队处理。
   */
  async reprocess(
    userId: string,
    documentId: string,
  ): Promise<UploadDocumentResponseDto> {
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

    if (doc.status === KnowledgeDocumentStatus.PROCESSING) {
      throw new BusinessException(
        '文档正在处理中，请稍后再试',
        ErrorCode.KnowledgeBaseInvalidStatus,
        HttpStatus.BAD_REQUEST,
      );
    }

    const config = doc.chunkConfig as unknown as ChunkConfig | null;
    if (!config?.chunkType) {
      throw new BusinessException(
        '文档缺少切分配置，无法重新处理',
        ErrorCode.KnowledgeChunkConfigInvalid,
        HttpStatus.BAD_REQUEST,
      );
    }

    const fileAsset = await this.fileService.getReadyFileForUser(doc.fileId, {
      id: userId,
      email: '',
      username: '',
    });
    const ext = this.extractExtension(fileAsset.originalName);
    this.ensureParsableExtension(ext);

    // FAILED 文档的 chunks 只可能来自旧的成功运行，清掉再重跑。
    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId } });

    await this.prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: { status: KnowledgeDocumentStatus.PROCESSING, errorMessage: null },
    });

    // 流水线入队：状态已在上面置 PROCESSING，后台任务负责推进或标 FAILED。
    this.taskQueue.enqueue(async () => {
      try {
        const buffer = await this.fileService.getFileBufferForInternal(
          doc.fileId,
        );
        await this.runIngestPipeline(doc.id, buffer, ext, config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `文档 ${doc.id} 后台重处理失败: ${message.slice(0, 500)}`,
        );
        await this.prisma.knowledgeDocument
          .update({
            where: { id: doc.id },
            data: {
              status: KnowledgeDocumentStatus.FAILED,
              errorMessage: message.slice(0, 2000),
            },
          })
          .catch(() => undefined);
      }
    });

    const withFile = await this.prisma.knowledgeDocument.findUniqueOrThrow({
      where: { id: doc.id },
      include: { file: true },
    });
    return {
      document: this.toDocumentResponse(withFile),
      chunkSummary: null,
    };
  }

  /**
   * 流水线主体：解析 → 切分 → 向量化 → 事务入库，每阶段回写文档状态。
   */
  private async runIngestPipeline(
    documentId: string,
    buffer: Buffer,
    ext: string,
    config: ChunkConfig,
  ): Promise<{ totalChunks: number; totalChars: number }> {
    const updateStatus = (data: Prisma.KnowledgeDocumentUpdateInput) =>
      this.prisma.knowledgeDocument.update({ where: { id: documentId }, data });

    // 2. 解析为纯文本。
    const parsed = await this.documentParser.parse(buffer, ext);
    await updateStatus({ status: KnowledgeDocumentStatus.PARSED });

    // 3. 切分：md 保留扩展名（支持 leveled），其余统一按 txt 规则。
    const { meta, chunks } = chunk(parsed.text, ext === 'md' ? 'md' : 'txt', config);
    if (chunks.length === 0) {
      throw new BusinessException(
        'document produced no chunks',
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }
    await updateStatus({
      status: KnowledgeDocumentStatus.CHUNKED,
      chunkType: meta.chunkType,
      chunkConfig: config as unknown as Prisma.InputJsonValue,
      chunkCount: meta.totalChunks,
      totalChars: meta.totalChars,
    });

    // 4. 事务外做耗时的 embedding 调用。失败则 chunks 尚未落库。
    await updateStatus({ status: KnowledgeDocumentStatus.EMBEDDING });
    const vectors = await this.embedder.embed(chunks.map((c) => c.content));
    if (vectors.length !== chunks.length) {
      throw new BusinessException(
        `embedding count mismatch: chunks=${chunks.length}, vectors=${vectors.length}`,
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }

    // 5. 单事务写入 chunks + 向量，成功后置 READY。
    const doc = await this.prisma.knowledgeDocument.findUniqueOrThrow({
      where: { id: documentId },
      select: { knowledgeBaseId: true, workspaceId: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const chunkIds = chunks.map(() => randomUUID());

      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        await tx.$executeRaw`
          INSERT INTO "KnowledgeChunk" ("id", "documentId", "knowledgeBaseId", "workspaceId", "content", "index", "vectorId", "updatedAt")
          VALUES (
            ${chunkIds[i]},
            ${documentId},
            ${doc.knowledgeBaseId},
            ${doc.workspaceId},
            ${c.content},
            ${c.index},
            NULL,
            NOW()
          )
        `;
      }

      await this.retrievalService.indexChunks(
        tx,
        chunks.map((_, i) => ({ chunkId: chunkIds[i], vector: vectors[i] })),
        this.embedder.model,
        this.embedder.dimensions,
      );
    });

    await updateStatus({ status: KnowledgeDocumentStatus.READY });

    return {
      totalChunks: meta.totalChunks,
      totalChars: meta.totalChars,
    };
  }

  private ensureParsableExtension(ext: string): void {
    if (DocumentParserService.isLegacyUnsupported(ext)) {
      throw new BusinessException(
        `暂不支持 .${ext} 旧格式，请用 Office 另存为 .docx / .xlsx 或导出 PDF 后上传`,
        ErrorCode.KnowledgeFileTypeUnsupported,
        HttpStatus.BAD_REQUEST,
      );
    }
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
    await this.knowledgeBaseService.findOneForUser(userId, doc.knowledgeBaseId);

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
    await this.knowledgeBaseService.findOneForUser(userId, doc.knowledgeBaseId);

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

  async deleteChunk(userId: string, documentId: string, index: number) {
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
      chunkConfig: (doc.chunkConfig ?? {}) as unknown as Record<
        string,
        unknown
      >,
      totalChunks: doc.chunkCount,
      totalChars: doc.totalChars,
      status: doc.status,
      errorMessage: doc.errorMessage,
      createdAt: formatShanghaiDateTime(doc.createdAt),
    };
  }
}
