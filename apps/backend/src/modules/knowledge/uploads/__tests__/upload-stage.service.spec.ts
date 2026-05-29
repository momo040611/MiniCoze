import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PrismaService } from '../../../../database/prisma.service';
import { UploadStageService } from '../upload-stage.service';
import type { UploadStorage } from '../upload-storage.interface';

const buildStage = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'stage1',
  fileId: 'f1',
  uploaderId: 'u1',
  originalName: 'demo.txt',
  fileExtension: 'txt',
  fileSize: 11,
  storagePath: '/tmp/abc',
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
  ...overrides,
});

describe('UploadStageService', () => {
  let prisma: {
    knowledgeUploadStage: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };
  let storage: UploadStorage & {
    put: jest.Mock;
    get: jest.Mock;
    remove: jest.Mock;
    exists: jest.Mock;
  };
  let service: UploadStageService;

  beforeEach(() => {
    prisma = {
      knowledgeUploadStage: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    storage = {
      put: jest.fn().mockResolvedValue({ fileId: 'f1', storagePath: '/tmp/x' }),
      get: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn(),
    };
    service = new UploadStageService(
      prisma as unknown as PrismaService,
      storage,
    );
  });

  it('createStage: storage.put + DB create 各调一次', async () => {
    prisma.knowledgeUploadStage.create.mockResolvedValueOnce(buildStage());
    const out = await service.createStage(
      'u1',
      'demo.txt',
      'txt',
      Buffer.from('hello world'),
    );
    expect(storage.put).toHaveBeenCalledTimes(1);
    expect(prisma.knowledgeUploadStage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileId: 'f1',
        uploaderId: 'u1',
        originalName: 'demo.txt',
        fileSize: 11,
      }),
    });
    expect(out.fileId).toBe('f1');
  });

  it('createStage DB 失败 → 回滚已写盘', async () => {
    prisma.knowledgeUploadStage.create.mockRejectedValueOnce(new Error('db'));
    await expect(
      service.createStage('u1', 'demo.txt', 'txt', Buffer.from('x')),
    ).rejects.toThrow();
    expect(storage.remove).toHaveBeenCalledWith('f1');
  });

  it('loadForUser: 同人 + 未过期 → 返回 stage 与 buffer', async () => {
    prisma.knowledgeUploadStage.findUnique.mockResolvedValueOnce(buildStage());
    storage.get.mockResolvedValueOnce(Buffer.from('content'));
    const { stage, buffer } = await service.loadForUser('u1', 'f1');
    expect(stage.fileId).toBe('f1');
    expect(buffer.toString()).toBe('content');
  });

  it('loadForUser: 不存在 → KnowledgeUploadStageNotFound', async () => {
    prisma.knowledgeUploadStage.findUnique.mockResolvedValueOnce(null);
    try {
      await service.loadForUser('u1', 'missing');
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeUploadStageNotFound,
      );
    }
  });

  it('loadForUser: 非 uploader → Forbidden', async () => {
    prisma.knowledgeUploadStage.findUnique.mockResolvedValueOnce(
      buildStage({ uploaderId: 'someone-else' }),
    );
    try {
      await service.loadForUser('u1', 'f1');
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(ErrorCode.Forbidden);
    }
  });

  it('loadForUser: 过期 → KnowledgeUploadStageExpired', async () => {
    prisma.knowledgeUploadStage.findUnique.mockResolvedValueOnce(
      buildStage({ expiresAt: new Date(Date.now() - 1000) }),
    );
    try {
      await service.loadForUser('u1', 'f1');
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeUploadStageExpired,
      );
    }
  });

  it('loadForUser: 文件丢失 → 删表行 + KnowledgeUploadStageNotFound', async () => {
    prisma.knowledgeUploadStage.findUnique.mockResolvedValueOnce(buildStage());
    storage.get.mockResolvedValueOnce(null);
    try {
      await service.loadForUser('u1', 'f1');
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeUploadStageNotFound,
      );
    }
    expect(prisma.knowledgeUploadStage.delete).toHaveBeenCalledWith({
      where: { fileId: 'f1' },
    });
  });

  it('removeForUser: 同人 → storage.remove + DB delete', async () => {
    prisma.knowledgeUploadStage.findUnique.mockResolvedValueOnce(buildStage());
    await service.removeForUser('u1', 'f1');
    expect(storage.remove).toHaveBeenCalledWith('f1');
    expect(prisma.knowledgeUploadStage.delete).toHaveBeenCalled();
  });

  it('removeForUser: 非同人 → Forbidden，不删', async () => {
    prisma.knowledgeUploadStage.findUnique.mockResolvedValueOnce(
      buildStage({ uploaderId: 'other' }),
    );
    try {
      await service.removeForUser('u1', 'f1');
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(ErrorCode.Forbidden);
    }
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('removeAfterIngest: best-effort，storage 失败时 log 不抛', async () => {
    storage.remove.mockRejectedValueOnce(new Error('disk full'));
    await expect(service.removeAfterIngest('f1')).resolves.toBeUndefined();
  });

  it('runGc: 没有过期 → 不调 storage', async () => {
    prisma.knowledgeUploadStage.findMany.mockResolvedValueOnce([]);
    await service.runGc();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('runGc: 找到过期行 → storage.remove + DB delete', async () => {
    prisma.knowledgeUploadStage.findMany.mockResolvedValueOnce([
      { fileId: 'f1' },
      { fileId: 'f2' },
    ]);
    await service.runGc();
    expect(storage.remove).toHaveBeenCalledTimes(2);
    expect(prisma.knowledgeUploadStage.delete).toHaveBeenCalledTimes(2);
  });

  it('runGc: 单条删盘失败仍继续删表行', async () => {
    prisma.knowledgeUploadStage.findMany.mockResolvedValueOnce([
      { fileId: 'f1' },
    ]);
    storage.remove.mockRejectedValueOnce(new Error('io'));
    await service.runGc();
    // 即使 storage.remove 抛错，DB delete 仍被调用
    expect(prisma.knowledgeUploadStage.delete).toHaveBeenCalledWith({
      where: { fileId: 'f1' },
    });
  });
});
