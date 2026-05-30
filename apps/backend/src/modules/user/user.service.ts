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
    try {
      const user = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: updateCurrentUserDto,
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

      throw error;
    }
  }

  toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      phone: user.phone ?? null,
      bio: user.bio ?? null,
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
}
