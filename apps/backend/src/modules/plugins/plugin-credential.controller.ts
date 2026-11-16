import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { UpsertPluginCredentialDto } from './dto/upsert-plugin-credential.dto';
import { PluginCredentialService } from './plugin-credential.service';

@ApiTags('plugins')
@Controller('plugins/:pluginId/credentials')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PluginCredentialController {
  constructor(private readonly credentialService: PluginCredentialService) {}

  @Get()
  @ApiOperation({ summary: '列出插件凭据（仅掩码，不回传明文）' })
  list(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
  ) {
    return this.credentialService.list(currentUser.id, pluginId);
  }

  @Post()
  @ApiOperation({ summary: '为插件创建凭据（secret 加密落库）' })
  create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
    @Body() dto: UpsertPluginCredentialDto,
  ) {
    return this.credentialService.create(currentUser.id, pluginId, dto);
  }

  @Patch(':credentialId')
  @ApiOperation({ summary: '更新插件凭据（缺省 secret 表示保持原值）' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
    @Param('credentialId') credentialId: string,
    @Body() dto: UpsertPluginCredentialDto,
  ) {
    return this.credentialService.update(
      currentUser.id,
      pluginId,
      credentialId,
      dto,
    );
  }

  @Delete(':credentialId')
  @ApiOperation({ summary: '删除插件凭据' })
  async remove(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
    @Param('credentialId') credentialId: string,
  ) {
    await this.credentialService.remove(currentUser.id, pluginId, credentialId);
    return { success: true };
  }
}
