import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalDiskStorage } from '../local-disk.storage';

describe('LocalDiskStorage', () => {
  let dir: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'minicoze-storage-'));
    const config = {
      get: jest.fn().mockReturnValue(dir),
    } as unknown as ConfigService;
    storage = new LocalDiskStorage(config);
    await storage.onModuleInit();
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it('put → 返回 fileId 与 storagePath；同 fileId 可读回', async () => {
    const out = await storage.put(Buffer.from('hello world', 'utf8'), 'txt');
    expect(out.fileId).toMatch(/^[0-9a-f-]{36}$/);
    expect(out.storagePath.startsWith(dir)).toBe(true);
    const back = await storage.get(out.fileId);
    expect(back?.toString('utf8')).toBe('hello world');
  });

  it('exists: 写入后为 true，删后为 false', async () => {
    const { fileId } = await storage.put(Buffer.from('x'), 'md');
    expect(await storage.exists(fileId)).toBe(true);
    await storage.remove(fileId);
    expect(await storage.exists(fileId)).toBe(false);
  });

  it('get 不存在的 fileId → null', async () => {
    const out = await storage.get('00000000-0000-0000-0000-000000000000');
    expect(out).toBeNull();
  });

  it('remove 不存在的 fileId → 不抛错（幂等）', async () => {
    await expect(
      storage.remove('00000000-0000-0000-0000-000000000000'),
    ).resolves.toBeUndefined();
  });

  it('非法 fileId 格式 → exists/get 直接 false/null', async () => {
    expect(await storage.exists('not-a-uuid')).toBe(false);
    expect(await storage.get('not-a-uuid')).toBeNull();
  });

  it('扩展名含特殊字符被清洗', async () => {
    const out = await storage.put(Buffer.from('x'), 'tx t/../');
    expect(out.storagePath).toMatch(/\.txt\.bin$/);
  });
});
