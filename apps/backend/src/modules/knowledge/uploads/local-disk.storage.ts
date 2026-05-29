import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import type {
  PutResult,
  UploadStorage,
} from './upload-storage.interface';

@Injectable()
export class LocalDiskStorage implements UploadStorage, OnModuleInit {
  private readonly logger = new Logger(LocalDiskStorage.name);
  private readonly baseDir: string;

  constructor(configService: ConfigService) {
    const dir = configService.get<string>('UPLOAD_STORAGE_DIR', {
      infer: true,
    }) ?? './storage/uploads';
    this.baseDir = resolve(dir);
  }

  async onModuleInit(): Promise<void> {
    if (!existsSync(this.baseDir)) {
      await mkdir(this.baseDir, { recursive: true });
      this.logger.log(`upload storage dir created: ${this.baseDir}`);
    }
  }

  async put(buffer: Buffer, extension: string): Promise<PutResult> {
    const fileId = randomUUID();
    const safeExt = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const filename = `${fileId}.${safeExt}.bin`;
    const storagePath = join(this.baseDir, filename);
    try {
      await writeFile(storagePath, buffer);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      throw new BusinessException(
        `failed to write upload stage to disk: ${reason}`,
        ErrorCode.InternalServerError,
      );
    }
    return { fileId, storagePath };
  }

  async get(fileId: string): Promise<Buffer | null> {
    const path = await this.findPath(fileId);
    if (!path) return null;
    try {
      return await readFile(path);
    } catch {
      return null;
    }
  }

  async remove(fileId: string): Promise<void> {
    const path = await this.findPath(fileId);
    if (!path) return;
    try {
      await unlink(path);
    } catch (e) {
      // 文件可能已被外部清理；只记日志，不向上抛。
      const reason = e instanceof Error ? e.message : String(e);
      this.logger.warn(`failed to unlink ${path}: ${reason}`);
    }
  }

  async exists(fileId: string): Promise<boolean> {
    return (await this.findPath(fileId)) !== null;
  }

  /**
   * 通过 fileId 反查实际文件路径。put 时文件名格式 `${fileId}.${ext}.bin`，
   * 这里用通配匹配（fileId 唯一，最多一个匹配）。
   */
  private async findPath(fileId: string): Promise<string | null> {
    if (!/^[0-9a-fA-F-]{36}$/.test(fileId)) return null;
    const { readdir } = await import('fs/promises');
    let entries: string[];
    try {
      entries = await readdir(this.baseDir);
    } catch {
      return null;
    }
    const match = entries.find((name) => name.startsWith(`${fileId}.`));
    return match ? join(this.baseDir, match) : null;
  }
}
