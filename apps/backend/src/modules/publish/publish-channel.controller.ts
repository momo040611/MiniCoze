import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublishChannelType } from '@prisma/client';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { RotateApiKeyDto } from './dto/rotate-api-key.dto';
import { UpdatePublishChannelDto } from './dto/update-publish-channel.dto';
import { PublishChannelService } from './publish-channel.service';

@ApiTags('publish-channel')
@Controller('publish/agents/:agentId/channels')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PublishChannelController {
  constructor(private readonly publishChannelService: PublishChannelService) {}

  @Get()
  @ApiOperation({ summary: '查询 Agent 发布渠道配置' })
  listAgentChannels(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
  ) {
    return this.publishChannelService.listAgentChannels(
      currentUser.id,
      agentId,
    );
  }

  @Post('api/rotate-key')
  @ApiOperation({ summary: '重新生成 API 渠道 Key' })
  rotateApiKey(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Body() dto: RotateApiKeyDto,
  ) {
    return this.publishChannelService.rotateApiKey(
      currentUser.id,
      agentId,
      dto,
    );
  }

  @Put(':channel')
  @ApiOperation({ summary: '更新 Agent 发布渠道配置' })
  updateAgentChannel(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Param('channel', new ParseEnumPipe(PublishChannelType))
    channel: PublishChannelType,
    @Body() dto: UpdatePublishChannelDto,
  ) {
    return this.publishChannelService.updateAgentChannel(
      currentUser.id,
      agentId,
      channel,
      dto,
    );
  }

  @Post(':channel/enable')
  @ApiOperation({ summary: '启用 Agent 发布渠道' })
  enableAgentChannel(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Param('channel', new ParseEnumPipe(PublishChannelType))
    channel: PublishChannelType,
  ) {
    return this.publishChannelService.enableAgentChannel(
      currentUser.id,
      agentId,
      channel,
    );
  }

  @Post(':channel/disable')
  @ApiOperation({ summary: '禁用 Agent 发布渠道' })
  disableAgentChannel(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Param('channel', new ParseEnumPipe(PublishChannelType))
    channel: PublishChannelType,
  ) {
    return this.publishChannelService.disableAgentChannel(
      currentUser.id,
      agentId,
      channel,
    );
  }
}
