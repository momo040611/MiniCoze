import { HttpStatus, Injectable } from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureMember(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
    if (!member) {
      throw new BusinessException(
        '无权访问该工作空间',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }

    return member;
  }

  async ensureCanManage(userId: string, workspaceId: string) {
    const member = await this.ensureMember(userId, workspaceId);

    if (
      member.role !== WorkspaceRole.OWNER &&
      member.role !== WorkspaceRole.ADMIN
    ) {
      throw new BusinessException(
        '无权管理该工作空间',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }

    return member;
  }

  async ensureOwner(userId: string, workspaceId: string) {
    const member = await this.ensureMember(userId, workspaceId);

    if (member.role !== WorkspaceRole.OWNER) {
      throw new BusinessException(
        '只有工作空间所有者可以执行该操作',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }

    return member;
  }
}
