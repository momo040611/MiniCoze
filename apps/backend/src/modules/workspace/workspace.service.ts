import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Workspace, WorkspaceRole } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceQueryDto } from './dto/workspace-query.dto';
import { WorkspaceResponse } from './types/workspace-response.type';
import { WorkspaceAccessService } from './workspace-access.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async create(
    userId: string,
    createWorkspaceDto: CreateWorkspaceDto,
  ): Promise<WorkspaceResponse> {
    const workspace = await this.prisma.$transaction(async (tx) => {
      const createdWorkspace = await tx.workspace.create({
        data: {
          name: createWorkspaceDto.name,
          description: createWorkspaceDto.description,
          ownerId: userId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: createdWorkspace.id,
          userId,
          role: WorkspaceRole.OWNER,
        },
      });

      return createdWorkspace;
    });

    return this.toWorkspaceResponse(workspace, WorkspaceRole.OWNER);
  }

  async findMyWorkspaces(userId: string, query: WorkspaceQueryDto) {
    const { page, pageSize } = query;
    const where: Prisma.WorkspaceWhereInput = {
      members: {
        some: {
          userId,
        },
      },
    };

    const [workspaces, total] = await this.prisma.$transaction([
      this.prisma.workspace.findMany({
        where,
        include: {
          members: {
            where: {
              userId,
            },
            select: {
              role: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workspace.count({ where }),
    ]);

    return createPaginatedData({
      list: workspaces.map((workspace) =>
        this.toWorkspaceResponse(
          workspace,
          workspace.members[0]?.role ?? WorkspaceRole.MEMBER,
        ),
      ),
      total,
      page,
      pageSize,
    });
  }

  async findOneForUser(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceResponse> {
    const member = await this.workspaceAccessService.ensureMember(
      userId,
      workspaceId,
    );
    const workspace = await this.findWorkspaceOrThrow(workspaceId);

    return this.toWorkspaceResponse(workspace, member.role);
  }

  async update(
    userId: string,
    workspaceId: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponse> {
    const member = await this.workspaceAccessService.ensureCanManage(
      userId,
      workspaceId,
    );

    const workspace = await this.prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data: updateWorkspaceDto,
    });

    return this.toWorkspaceResponse(workspace, member.role);
  }

  async remove(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceResponse> {
    const member = await this.workspaceAccessService.ensureOwner(
      userId,
      workspaceId,
    );

    const workspace = await this.prisma.workspace.delete({
      where: {
        id: workspaceId,
      },
    });

    return this.toWorkspaceResponse(workspace, member.role);
  }

  private async findWorkspaceOrThrow(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new BusinessException(
        '工作空间不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return workspace;
  }

  // getDashboardSummary 已删除：仪表盘统一由 DashboardService.getSummary 提供
  // （GET /workspaces/:workspaceId/dashboard，dashboard.module），避免两套实现漂移。

  private toWorkspaceResponse(
    workspace: Workspace,
    role: WorkspaceRole,
  ): WorkspaceResponse {
    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      ownerId: workspace.ownerId,
      role,
      createdAt: formatShanghaiDateTime(workspace.createdAt),
      updatedAt: formatShanghaiDateTime(workspace.updatedAt),
    };
  }
}
