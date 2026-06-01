import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceRole } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceService } from './workspace.service';

const now = new Date('2026-05-13T00:00:00.000Z');

const workspace = {
  id: 'workspace-id',
  name: '默认空间',
  description: '测试空间',
  ownerId: 'user-id',
  createdAt: now,
  updatedAt: now,
};

interface WorkspaceTransactionMock {
  workspace: {
    create: jest.Mock;
  };
  workspaceMember: {
    create: jest.Mock;
  };
}

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let prisma: {
    $transaction: jest.Mock;
    workspace: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    workspaceMember: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      workspace: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workspaceMember: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        WorkspaceAccessService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(WorkspaceService);
  });

  it('creates workspace and owner member in one transaction', async () => {
    prisma.$transaction.mockImplementation(
      (callback: (tx: WorkspaceTransactionMock) => Promise<unknown>) =>
        callback({
          workspace: {
            create: jest.fn().mockResolvedValue(workspace),
          },
          workspaceMember: {
            create: jest.fn().mockResolvedValue({
              id: 'member-id',
              workspaceId: workspace.id,
              userId: 'user-id',
              role: WorkspaceRole.OWNER,
            }),
          },
        }),
    );

    const result = await service.create('user-id', {
      name: workspace.name,
      description: workspace.description,
    });

    expect(result).toMatchObject({
      id: workspace.id,
      role: WorkspaceRole.OWNER,
    });
  });

  it('returns paginated workspaces for current user', async () => {
    prisma.workspace.findMany.mockResolvedValue([
      {
        ...workspace,
        members: [{ role: WorkspaceRole.ADMIN }],
      },
    ]);
    prisma.workspace.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((queries) => Promise.all(queries));

    const result = await service.findMyWorkspaces('user-id', {
      page: 1,
      pageSize: 20,
    });

    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      list: [
        {
          id: workspace.id,
          role: WorkspaceRole.ADMIN,
        },
      ],
    });
  });

  it('rejects workspace detail when current user is not a member', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      service.findOneForUser('user-id', workspace.id),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    } satisfies { status: number });
  });

  it('rejects workspace update for member role', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: 'member-id',
      workspaceId: workspace.id,
      userId: 'user-id',
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      service.update('user-id', workspace.id, { name: '新空间' }),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    } satisfies { status: number });
  });

  it('rejects workspace removal for non-owner role', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: 'member-id',
      workspaceId: workspace.id,
      userId: 'user-id',
      role: WorkspaceRole.ADMIN,
    });

    await expect(service.remove('user-id', workspace.id)).rejects.toMatchObject(
      {
        status: HttpStatus.FORBIDDEN,
      } satisfies { status: number },
    );
  });
});
