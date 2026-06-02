import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateCurrentUserDto } from '../user/dto/update-current-user.dto';
import { AuthResponse } from './types/auth-response.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '注册账号' })
  register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: '登录账号' })
  login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
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
