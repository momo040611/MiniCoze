import type { Readable } from 'stream';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface SaveFileInput {
  buffer: Buffer;
  storageKey: string;
}

export interface StorageFileStat {
  size: number;
}

export interface StorageService {
  save(input: SaveFileInput): Promise<void>;
  getStream(storageKey: string): Promise<Readable>;
  getStat(storageKey: string): Promise<StorageFileStat>;
  remove(storageKey: string): Promise<void>;
}
