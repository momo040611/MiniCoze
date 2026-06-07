import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { OfflineAgentDto } from './dto/offline-agent.dto';
import { PublishAgentDto } from './dto/publish-agent.dto';
import { RollbackAgentDto } from './dto/rollback-agent.dto';
import { PublishService } from './publish.service';

@ApiTags('publish')
@Controller('publish')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Get('agents/:agentId/check')
  @ApiOperation({ summary: '检查 Agent 是否可发布' })
  checkAgent(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
  ) {
    return this.publishService.checkAgent(currentUser.id, agentId);
  }

  @Post('agents/:agentId')
  @ApiOperation({ summary: '发布 Agent' })
  publishAgent(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Body() dto: PublishAgentDto,
  ) {
    return this.publishService.publishAgent(currentUser.id, agentId, dto);
  }

  @Get('agents/:agentId/versions')
  @ApiOperation({ summary: '获取 Agent 发布版本列表' })
  listAgentVersions(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
  ) {
    return this.publishService.listAgentVersions(currentUser.id, agentId);
  }

  @Get('agents/:agentId/records')
  @ApiOperation({ summary: '获取 Agent 发布记录' })
  listAgentRecords(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
  ) {
    return this.publishService.listAgentRecords(currentUser.id, agentId);
  }

  @Post('agents/:agentId/rollback')
  @ApiOperation({ summary: '回滚 Agent 到指定发布版本' })
  rollbackAgent(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Body() dto: RollbackAgentDto,
  ) {
    return this.publishService.rollbackAgent(currentUser.id, agentId, dto);
  }

  @Post('agents/:agentId/offline')
  @ApiOperation({ summary: '下线 Agent' })
  offlineAgent(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Body() dto: OfflineAgentDto,
  ) {
    return this.publishService.offlineAgent(currentUser.id, agentId, dto);
  }
}
