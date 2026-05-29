import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { KnowledgeUploadStage } from '@prisma/client';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../../common/utils/date-time';
import { PrismaService } from '../../../database/prisma.service';
import { UploadStageResponseDto } from './dto/upload-stage-response.dto';
import { UPLOAD_STORAGE_TOKEN } from './upload-storage.interface';
import type { UploadStorage } from './upload-storage.interface';

const STAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class UploadStageService implements OnModuleInit {
  private readonly logger = new Logger(UploadStageService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(UPLOAD_STORAGE_TOKEN) private readonly storage: UploadStorage,
  ) {}

  /** 启动期跑一次 GC，清理上次进程退出时未清的过期 stage。 */
  async onModuleInit(): Promise<void> {
    this.runGc().catch((e: unknown) => {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.error(`startup GC failed: ${reason}`);
    });
  }

  async createStage(
    uploaderId: string,
    originalName: string,
    fileExtension: string,
    buffer: Buffer,
  ): Promise<UploadStageResponseDto> {
    const { fileId, storagePath } = await this.storage.put(
      buffer,
      fileExtension,
    );
    const expiresAt = new Date(Date.now() + STAGE_TTL_MS);

    let row: KnowledgeUploadStage;
    try {
      row = await this.prisma.knowledgeUploadStage.create({
        data: {
          fileId,
          uploaderId,
          originalName,
          fileExtension,
          fileSize: buffer.byteLength,
          storagePath,
          expiresAt,
        },
      });
    } catch (e) {
      // DB 写入失败 → 回滚已写入的磁盘文件，避免孤儿
      await this.storage.remove(fileId);
      throw e;
    }

    return this.toResponse(row);
  }

  /**
   * 加载 stage 给"切分预览/入库"使用。
   * 校验：存在 + 同 uploader + 未过期。
   * 返回 stage 元数据 + 文件 buffer。
   */
  async loadForUser(
    uploaderId: string,
    fileId: string,
  ): Promise<{ stage: KnowledgeUploadStage; buffer: Buffer }> {
    const stage = await this.findByFileIdOrThrow(fileId);

    if (stage.uploaderId !== uploaderId) {
      throw new BusinessException(
        '无权访问该上传 stage',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }
    if (stage.expiresAt.getTime() < Date.now()) {
      throw new BusinessException(
        '上传 stage 已过期，请重新上传文件',
        ErrorCode.KnowledgeUploadStageExpired,
      );
    }

    const buffer = await this.storage.get(fileId);
    if (buffer === null) {
      // 文件丢了（被外部删 / 磁盘故障）→ 把表行也删掉，让用户重传
      await this.prisma.knowledgeUploadStage
        .delete({ where: { fileId } })
        .catch(() => undefined);
      throw new BusinessException(
        '上传 stage 文件已丢失',
        ErrorCode.KnowledgeUploadStageNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    return { stage, buffer };
  }

  /** 用户主动取消。 */
  async removeForUser(
    uploaderId: string,
    fileId: string,
  ): Promise<UploadStageResponseDto> {
    const stage = await this.findByFileIdOrThrow(fileId);
    if (stage.uploaderId !== uploaderId) {
      throw new BusinessException(
        '无权删除该上传 stage',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }
    await this.storage.remove(fileId);
    await this.prisma.knowledgeUploadStage.delete({ where: { fileId } });
    return this.toResponse(stage);
  }

  /**
   * 入库成功后清理 stage。best-effort：失败仅 log 不抛，
   * 让接口仍然返回 200。GC 兜底。
   */
  async removeAfterIngest(fileId: string): Promise<void> {
    try {
      await this.storage.remove(fileId);
      await this.prisma.knowledgeUploadStage
        .delete({ where: { fileId } })
        .catch(() => undefined);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(`removeAfterIngest failed for ${fileId}: ${reason}`);
    }
  }

  async getForUser(
    uploaderId: string,
    fileId: string,
  ): Promise<UploadStageResponseDto> {
    const stage = await this.findByFileIdOrThrow(fileId);
    if (stage.uploaderId !== uploaderId) {
      throw new BusinessException(
        '无权访问该上传 stage',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }
    return this.toResponse(stage);
  }

  /** 每小时跑一次 GC，清理所有过期 stage。 */
  @Cron(CronExpression.EVERY_HOUR)
  async runGc(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.knowledgeUploadStage.findMany({
      where: { expiresAt: { lt: now } },
      select: { fileId: true },
    });
    if (expired.length === 0) return;

    let deletedFiles = 0;
    let deletedRows = 0;
    for (const { fileId } of expired) {
      try {
        await this.storage.remove(fileId);
        deletedFiles++;
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        this.logger.warn(`gc remove file failed for ${fileId}: ${reason}`);
      }
      try {
        await this.prisma.knowledgeUploadStage.delete({ where: { fileId } });
        deletedRows++;
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        this.logger.warn(`gc remove row failed for ${fileId}: ${reason}`);
      }
    }
    this.logger.log(
      `gc swept ${expired.length} expired stages: ${deletedFiles} files / ${deletedRows} rows removed`,
    );
  }

  private async findByFileIdOrThrow(
    fileId: string,
  ): Promise<KnowledgeUploadStage> {
    const stage = await this.prisma.knowledgeUploadStage.findUnique({
      where: { fileId },
    });
    if (!stage) {
      throw new BusinessException(
        '上传 stage 不存在',
        ErrorCode.KnowledgeUploadStageNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    return stage;
  }

  private toResponse(row: KnowledgeUploadStage): UploadStageResponseDto {
    return {
      fileId: row.fileId,
      originalName: row.originalName,
      fileExtension: row.fileExtension,
      fileSize: row.fileSize,
      expiresAt: formatShanghaiDateTime(row.expiresAt),
      createdAt: formatShanghaiDateTime(row.createdAt),
    };
  }
}
