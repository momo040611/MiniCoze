import {
  Body,
  Ip,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateCurrentUserDto } from '../user/dto/update-current-user.dto';
import type { UploadedFile as UploadedFileType } from '../file/types/uploaded-file.type';
import { AuthResponse } from './types/auth-response.type';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '注册账号' })
  register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登录账号' })
  login(
    @Body() loginDto: LoginDto,
    @Ip() clientIp: string,
  ): Promise<AuthResponse> {
    return this.authService.login(loginDto, clientIp || 'unknown');
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户' })
  profile(@CurrentUserInfo() currentUser: CurrentUser) {
    return this.authService.getProfile(currentUser.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新当前登录用户资料' })
  updateProfile(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() updateCurrentUserDto: UpdateCurrentUserDto,
  ) {
    return this.authService.updateProfile(currentUser.id, updateCurrentUserDto);
  }

  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'file', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 52428800,
          files: 1,
        },
      },
    ),
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: '上传并更新当前登录用户头像' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  updateAvatar(
    @CurrentUserInfo() currentUser: CurrentUser,
    @UploadedFiles()
    files: {
      avatar?: UploadedFileType[];
      file?: UploadedFileType[];
    },
  ) {
    const file = files.avatar?.[0] ?? files.file?.[0];
    return this.authService.updateAvatar(currentUser.id, file);
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改当前登录用户密码' })
  changePassword(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(currentUser.id, changePasswordDto);
  }
}
