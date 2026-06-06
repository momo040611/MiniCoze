import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { UpdateCurrentUserDto } from './dto/update-current-user.dto';
import { UserResponse } from './types/user-response.type';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new BusinessException(
        '用户不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toUserResponse(user);
  }

  async updateCurrentUser(
    userId: string,
    updateCurrentUserDto: UpdateCurrentUserDto,
  ): Promise<UserResponse> {
    const data: Prisma.UserUpdateInput = {};

    if (updateCurrentUserDto.username !== undefined) {
      data.username = updateCurrentUserDto.username;
    }
    if (updateCurrentUserDto.email !== undefined) {
      data.email = updateCurrentUserDto.email;
    }
    if (updateCurrentUserDto.phone !== undefined) {
      data.phone = updateCurrentUserDto.phone || null;
    }
    if (updateCurrentUserDto.bio !== undefined) {
      data.bio = updateCurrentUserDto.bio || null;
    }
    if (updateCurrentUserDto.avatarUrl !== undefined) {
      data.avatarUrl = updateCurrentUserDto.avatarUrl || null;
    }

    try {
      const user = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data,
      });

      return this.toUserResponse(user);
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        throw new BusinessException(
          '用户不存在',
          ErrorCode.NotFound,
          HttpStatus.NOT_FOUND,
        );
      }

      if (this.isUniqueConstraintError(error)) {
        throw new BusinessException(
          '邮箱已被使用',
          ErrorCode.UserAlreadyExists,
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }
  }

  toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone ?? '',
      bio: user.bio ?? '',
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: formatShanghaiDateTime(user.createdAt),
      updatedAt: formatShanghaiDateTime(user.updatedAt),
    };
  }

  private isRecordNotFoundError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
