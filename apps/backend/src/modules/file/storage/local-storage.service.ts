import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import type { Readable } from 'stream';
import {
  SaveFileInput,
  StorageFileStat,
  StorageService,
} from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly rootDir: string;

  constructor(private readonly configService: ConfigService) {
    const uploadDir =
      this.configService.get<string>('file.uploadDir') ?? 'storage/uploads';
    this.rootDir = path.resolve(process.cwd(), uploadDir);
  }

  async save(input: SaveFileInput): Promise<void> {
    const fullPath = this.resolveStoragePath(input.storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.buffer);
  }

  getStream(storageKey: string): Promise<Readable> {
    return Promise.resolve(
      createReadStream(this.resolveStoragePath(storageKey)),
    );
  }

  async getStat(storageKey: string): Promise<StorageFileStat> {
    const fileStat = await stat(this.resolveStoragePath(storageKey));
    return {
      size: fileStat.size,
    };
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.resolveStoragePath(storageKey), { force: true });
  }

  private resolveStoragePath(storageKey: string) {
    const fullPath = path.resolve(
      this.rootDir,
      storageKey.split('/').join(path.sep),
    );

    const relativePath = path.relative(this.rootDir, fullPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Invalid storage key');
    }

    return fullPath;
  }
}
