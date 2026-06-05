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
  status: 'ACTIVE',
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
      update: jest.Mock;
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
        update: jest.fn(),
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

  it('create: 成员校验通过 → 写入 KB', async () => {
    prisma.knowledgeBase.create.mockResolvedValueOnce(buildKb());

    const out = await service.create('u1', {
      workspaceId: 'ws1',
      name: 'KB',
    });

    expect(access.ensureMember).toHaveBeenCalledWith('u1', 'ws1');
    expect(prisma.knowledgeBase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws1',
        name: 'KB',
      }),
    });
    expect(out.id).toBe('kb1');
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

  it('toResponse: 派生 enabled = (status === ACTIVE)', async () => {
    prisma.knowledgeBase.findMany.mockResolvedValueOnce([
      buildKb({ id: 'kb1', status: 'ACTIVE' }),
      buildKb({ id: 'kb2', status: 'DISABLED' }),
      buildKb({ id: 'kb3', status: 'ARCHIVED' }),
    ]);
    const out = await service.findByWorkspace('u1', 'ws1');
    expect(out.map((kb) => kb.enabled)).toEqual([true, false, false]);
  });

  describe('toggleEnabled', () => {
    it('enabled=true 且当前 DISABLED → update 为 ACTIVE，返回 enabled=true', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValueOnce(
        buildKb({ status: 'DISABLED' }),
      );
      prisma.knowledgeBase.update.mockResolvedValueOnce(
        buildKb({ status: 'ACTIVE' }),
      );

      const out = await service.toggleEnabled('u1', 'kb1', true);

      expect(access.ensureCanManage).toHaveBeenCalledWith('u1', 'ws1');
      expect(prisma.knowledgeBase.update).toHaveBeenCalledWith({
        where: { id: 'kb1' },
        data: { status: 'ACTIVE' },
      });
      expect(out.enabled).toBe(true);
    });

    it('enabled=false 且当前 ACTIVE → update 为 DISABLED，返回 enabled=false', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValueOnce(
        buildKb({ status: 'ACTIVE' }),
      );
      prisma.knowledgeBase.update.mockResolvedValueOnce(
        buildKb({ status: 'DISABLED' }),
      );

      const out = await service.toggleEnabled('u1', 'kb1', false);

      expect(prisma.knowledgeBase.update).toHaveBeenCalledWith({
        where: { id: 'kb1' },
        data: { status: 'DISABLED' },
      });
      expect(out.enabled).toBe(false);
    });

    it('幂等：enabled=true 且当前已是 ACTIVE → 不调用 update', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValueOnce(
        buildKb({ status: 'ACTIVE' }),
      );

      const out = await service.toggleEnabled('u1', 'kb1', true);

      expect(prisma.knowledgeBase.update).not.toHaveBeenCalled();
      expect(out.enabled).toBe(true);
    });

    it('ARCHIVED → 抛 KnowledgeBaseInvalidStatus，不调用 update', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValueOnce(
        buildKb({ status: 'ARCHIVED' }),
      );

      try {
        await service.toggleEnabled('u1', 'kb1', true);
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeBaseInvalidStatus,
        );
      }
      expect(prisma.knowledgeBase.update).not.toHaveBeenCalled();
    });

    it('KB 不存在 → KnowledgeBaseNotFound', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValueOnce(null);
      try {
        await service.toggleEnabled('u1', 'missing', true);
        fail('should throw');
      } catch (e) {
        expect((e as BusinessException).getErrorCode()).toBe(
          ErrorCode.KnowledgeBaseNotFound,
        );
      }
      expect(prisma.knowledgeBase.update).not.toHaveBeenCalled();
    });

    it('非管理者 → Forbidden，不调用 update', async () => {
      prisma.knowledgeBase.findUnique.mockResolvedValueOnce(buildKb());
      access.ensureCanManage.mockRejectedValueOnce(
        new BusinessException('forbidden', ErrorCode.Forbidden),
      );
      await expect(
        service.toggleEnabled('u1', 'kb1', false),
      ).rejects.toBeInstanceOf(BusinessException);
      expect(prisma.knowledgeBase.update).not.toHaveBeenCalled();
    });
  });
});
