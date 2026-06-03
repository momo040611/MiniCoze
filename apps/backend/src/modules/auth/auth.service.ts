import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FilePurpose, Prisma, WorkspaceRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from '../../shared/types/current-user.type';
import { FileService } from '../file/file.service';
import { UploadedFile } from '../file/types/uploaded-file.type';
import { UserService } from '../user/user.service';
import { UpdateCurrentUserDto } from '../user/dto/update-current-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse } from './types/auth-response.type';

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  private readonly defaultWorkspaceName = '我的工作空间';
  private readonly defaultWorkspaceDescription = '默认工作空间';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly fileService: FileService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(
      registerDto.password,
      this.saltRounds,
    );

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            username: registerDto.username,
            email: registerDto.email,
            passwordHash,
          },
        });

        const workspace = await tx.workspace.create({
          data: {
            name: this.defaultWorkspaceName,
            description: this.defaultWorkspaceDescription,
            ownerId: createdUser.id,
          },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: createdUser.id,
            role: WorkspaceRole.OWNER,
          },
        });

        return createdUser;
      });

      return this.buildAuthResponse(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new BusinessException(
          '邮箱已被注册',
          ErrorCode.UserAlreadyExists,
          HttpStatus.CONFLICT,
        );
      }

      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: loginDto.email,
      },
    });

    if (!user) {
      throw new BusinessException(
        '邮箱或密码错误',
        ErrorCode.InvalidCredentials,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BusinessException(
        '邮箱或密码错误',
        ErrorCode.InvalidCredentials,
        HttpStatus.UNAUTHORIZED,
      );
    }
    // console.log('登录成功', user);
    await this.ensureDefaultWorkspace(user.id);

    return this.buildAuthResponse(user);
  }

  getProfile(userId: string) {
    return this.userService.findCurrentUser(userId);
  }

  updateProfile(userId: string, updateCurrentUserDto: UpdateCurrentUserDto) {
    return this.userService.updateCurrentUser(userId, updateCurrentUserDto);
  }

  async updateAvatar(userId: string, file: UploadedFile | undefined) {
    const uploadedFile = await this.fileService.upload(userId, file, {
      purpose: FilePurpose.AVATAR,
    });
    const avatarUrl = uploadedFile.url;

    if (!avatarUrl) {
      throw new BusinessException(
        '头像地址生成失败',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.userService.updateCurrentUser(userId, { avatarUrl });

    return { avatarUrl };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BusinessException(
        '用户不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new BusinessException(
        '当前密码不正确',
        ErrorCode.InvalidCredentials,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      this.saltRounds,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true };
  }

  private buildAuthResponse(user: Prisma.UserGetPayload<object>): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      tokenType: 'Bearer',
      user: this.userService.toUserResponse(user),
    };
  }

  private async ensureDefaultWorkspace(userId: string) {
    const existingMember = await this.prisma.workspaceMember.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (existingMember) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: this.defaultWorkspaceName,
          description: this.defaultWorkspaceDescription,
          ownerId: userId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER,
        },
      });
    });
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
