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

@ApiTags('publish-workflow-channel')
@Controller('publish/workflows/:workflowId/channels')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowPublishChannelController {
  constructor(private readonly publishChannelService: PublishChannelService) {}

  @Get()
  @ApiOperation({ summary: '查询工作流发布渠道配置' })
  listWorkflowChannels(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.publishChannelService.listWorkflowChannels(
      currentUser.id,
      workflowId,
    );
  }

  @Post('api/rotate-key')
  @ApiOperation({ summary: '重新生成工作流 API 渠道 Key' })
  rotateWorkflowApiKey(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: RotateApiKeyDto,
  ) {
    return this.publishChannelService.rotateWorkflowApiKey(
      currentUser.id,
      workflowId,
      dto,
    );
  }

  @Put(':channel')
  @ApiOperation({ summary: '更新工作流发布渠道配置' })
  updateWorkflowChannel(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Param('channel', new ParseEnumPipe(PublishChannelType))
    channel: PublishChannelType,
    @Body() dto: UpdatePublishChannelDto,
  ) {
    return this.publishChannelService.updateWorkflowChannel(
      currentUser.id,
      workflowId,
      channel,
      dto,
    );
  }

  @Post(':channel/enable')
  @ApiOperation({ summary: '启用工作流发布渠道' })
  enableWorkflowChannel(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Param('channel', new ParseEnumPipe(PublishChannelType))
    channel: PublishChannelType,
  ) {
    return this.publishChannelService.enableWorkflowChannel(
      currentUser.id,
      workflowId,
      channel,
    );
  }

  @Post(':channel/disable')
  @ApiOperation({ summary: '禁用工作流发布渠道' })
  disableWorkflowChannel(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Param('channel', new ParseEnumPipe(PublishChannelType))
    channel: PublishChannelType,
  ) {
    return this.publishChannelService.disableWorkflowChannel(
      currentUser.id,
      workflowId,
      channel,
    );
  }
}
