import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { PublishWorkflowDto } from '../workflow/dto/publish-workflow.dto';
import { OfflineWorkflowDto } from './dto/offline-workflow.dto';
import { RollbackWorkflowDto } from './dto/rollback-workflow.dto';
import { WorkflowPublishService } from './workflow-publish.service';

@ApiTags('publish-workflow')
@Controller('publish/workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowPublishController {
  constructor(
    private readonly workflowPublishService: WorkflowPublishService,
  ) {}

  @Get(':workflowId/check')
  @ApiOperation({ summary: '检查工作流是否可发布' })
  checkWorkflow(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.workflowPublishService.checkWorkflow(
      currentUser.id,
      workflowId,
    );
  }

  @Post(':workflowId')
  @ApiOperation({ summary: '发布工作流' })
  publishWorkflow(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: PublishWorkflowDto,
  ) {
    return this.workflowPublishService.publishWorkflow(
      currentUser.id,
      workflowId,
      dto,
    );
  }

  @Get(':workflowId/versions')
  @ApiOperation({ summary: '获取工作流发布版本列表' })
  listWorkflowVersions(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.workflowPublishService.listWorkflowVersions(
      currentUser.id,
      workflowId,
    );
  }

  @Get(':workflowId/records')
  @ApiOperation({ summary: '获取工作流发布记录' })
  listWorkflowRecords(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.workflowPublishService.listWorkflowRecords(
      currentUser.id,
      workflowId,
    );
  }

  @Post(':workflowId/rollback')
  @ApiOperation({ summary: '回滚工作流到指定发布版本' })
  rollbackWorkflow(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: RollbackWorkflowDto,
  ) {
    return this.workflowPublishService.rollbackWorkflow(
      currentUser.id,
      workflowId,
      dto,
    );
  }

  @Post(':workflowId/offline')
  @ApiOperation({ summary: '下线工作流' })
  offlineWorkflow(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: OfflineWorkflowDto,
  ) {
    return this.workflowPublishService.offlineWorkflow(
      currentUser.id,
      workflowId,
      dto,
    );
  }
}
