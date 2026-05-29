import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PrismaService } from '../../../../database/prisma.service';
import { WorkspaceAccessService } from '../../../workspace/workspace-access.service';
import { KnowledgeBaseService } from '../knowledge-base.service';
import type { Embedder } from '../../embedding/embedder.interface';

const fakeEmbedder: Embedder = {
  model: 'BAAI/bge-large-zh-v1.5',
  dimensions: 1024,
  embed: async () => [],
};

const buildKb = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'kb1',
  workspaceId: 'ws1',
  creatorId: 'u1',
  name: 'KB',
  description: null,
  embeddingModel: 'BAAI/bge-large-zh-v1.5',
  embeddingDim: 1024,
  createdAt: new Date('2026-05-28T00:00:00Z'),
  updatedAt: new Date('2026-05-28T00:00:00Z'),
  ...overrides,
});

describe('KnowledgeBaseService', () => {
  let prisma: {
    knowledgeBase: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
  };
  let access: { ensureMember: jest.Mock; ensureCanManage: jest.Mock };
  let service: KnowledgeBaseService;

  beforeEach(() => {
    prisma = {
      knowledgeBase: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    access = {
      ensureMember: jest.fn().mockResolvedValue({ role: 'MEMBER' }),
      ensureCanManage: jest.fn().mockResolvedValue({ role: 'OWNER' }),
    };
    service = new KnowledgeBaseService(
      prisma as unknown as PrismaService,
      access as unknown as WorkspaceAccessService,
      fakeEmbedder,
    );
  });

  it('create: 成员校验通过 → 写入 KB，固化当前 embedder 模型与维度', async () => {
    prisma.knowledgeBase.create.mockResolvedValueOnce(buildKb());

    const out = await service.create('u1', {
      workspaceId: 'ws1',
      name: 'KB',
    });

    expect(access.ensureMember).toHaveBeenCalledWith('u1', 'ws1');
    expect(prisma.knowledgeBase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        embeddingModel: 'BAAI/bge-large-zh-v1.5',
        embeddingDim: 1024,
      }),
    });
    expect(out.embeddingDim).toBe(1024);
  });

  it('create: 非成员 → 抛 Forbidden', async () => {
    access.ensureMember.mockRejectedValueOnce(
      new BusinessException('forbidden', ErrorCode.Forbidden),
    );
    await expect(
      service.create('u1', { workspaceId: 'ws1', name: 'KB' }),
    ).rejects.toBeInstanceOf(BusinessException);
    expect(prisma.knowledgeBase.create).not.toHaveBeenCalled();
  });

  it('findByWorkspace: 仅返回该 workspace 下的 KB', async () => {
    prisma.knowledgeBase.findMany.mockResolvedValueOnce([
      buildKb({ id: 'kb1' }),
      buildKb({ id: 'kb2' }),
    ]);
    const out = await service.findByWorkspace('u1', 'ws1');
    expect(out).toHaveLength(2);
    expect(prisma.knowledgeBase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws1' } }),
    );
  });

  it('remove: 不存在 → KnowledgeBaseNotFound', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValueOnce(null);
    try {
      await service.remove('u1', 'missing');
      fail('should throw');
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeBaseNotFound,
      );
    }
  });

  it('remove: 存在 + 有管理权限 → delete', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValueOnce(buildKb());
    prisma.knowledgeBase.delete.mockResolvedValueOnce(buildKb());
    await service.remove('u1', 'kb1');
    expect(access.ensureCanManage).toHaveBeenCalledWith('u1', 'ws1');
    expect(prisma.knowledgeBase.delete).toHaveBeenCalledWith({
      where: { id: 'kb1' },
    });
  });

  it('remove: 非管理者 → Forbidden，不删', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValueOnce(buildKb());
    access.ensureCanManage.mockRejectedValueOnce(
      new BusinessException('forbidden', ErrorCode.Forbidden),
    );
    await expect(service.remove('u1', 'kb1')).rejects.toBeInstanceOf(
      BusinessException,
    );
    expect(prisma.knowledgeBase.delete).not.toHaveBeenCalled();
  });

  it('findOneForUser: 存在 + 是成员 → 返回 KB', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValueOnce(buildKb());
    const out = await service.findOneForUser('u1', 'kb1');
    expect(out.id).toBe('kb1');
    expect(access.ensureMember).toHaveBeenCalledWith('u1', 'ws1');
  });

  it('findOneForUser: 不存在 → KnowledgeBaseNotFound', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOneForUser('u1', 'x')).rejects.toMatchObject({
      message: expect.stringContaining('不存在'),
    });
  });
});
