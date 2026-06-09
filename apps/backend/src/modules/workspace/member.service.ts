import { HttpStatus, Injectable } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from './workspace-access.service';

export interface MemberInfo {
  id: string;
  userId: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
  createdAt: string;
}

@Injectable()
export class MemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  /** 获取工作区成员列表 */
  async getMembers(
    userId: string,
    workspaceId: string,
  ): Promise<MemberInfo[]> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** 获取成员数量 */
  async getMemberCount(workspaceId: string): Promise<number> {
    return this.prisma.workspaceMember.count({
      where: { workspaceId },
    });
  }

  /** 添加成员 */
  async addMember(
    operatorId: string,
    workspaceId: string,
    email: string,
    role: WorkspaceRole = WorkspaceRole.MEMBER,
  ): Promise<MemberInfo> {
    await this.workspaceAccessService.ensureCanManage(operatorId, workspaceId);

    // 查找目标用户
    const targetUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, username: true, email: true, avatarUrl: true },
    });

    if (!targetUser) {
      throw new BusinessException(
        '用户不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    // 检查是否已是成员
    const existing = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUser.id },
      },
    });

    if (existing) {
      throw new BusinessException(
        '该用户已是工作区成员',
        ErrorCode.BusinessError,
        HttpStatus.CONFLICT,
      );
    }

    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role,
      },
    });

    return {
      id: member.id,
      userId: targetUser.id,
      username: targetUser.username,
      email: targetUser.email,
      avatarUrl: targetUser.avatarUrl,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
    };
  }

  /** 修改成员角色 */
  async updateMemberRole(
    operatorId: string,
    workspaceId: string,
    targetUserId: string,
    newRole: WorkspaceRole,
  ): Promise<void> {
    await this.workspaceAccessService.ensureOwner(operatorId, workspaceId);

    // 不能修改自己的角色
    if (operatorId === targetUserId) {
      throw new BusinessException(
        '不能修改自己的角色',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
    });

    if (!member) {
      throw new BusinessException(
        '成员不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role: newRole },
    });
  }

  /** 移除成员 */
  async removeMember(
    operatorId: string,
    workspaceId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.workspaceAccessService.ensureCanManage(operatorId, workspaceId);

    // 不能移除自己
    if (operatorId === targetUserId) {
      throw new BusinessException(
        '不能移除自己，请使用退出工作区功能',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 不能移除 OWNER
    const targetMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
    });

    if (!targetMember) {
      throw new BusinessException(
        '成员不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    if (targetMember.role === WorkspaceRole.OWNER) {
      throw new BusinessException(
        '不能移除工作区所有者',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.workspaceMember.delete({
      where: { id: targetMember.id },
    });
  }
}
