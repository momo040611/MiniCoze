import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { PublishWorkflowDto } from './dto/publish-workflow.dto';
import { SaveWorkflowGraphDto } from './dto/save-workflow-graph.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowQueryDto } from './dto/workflow-query.dto';
import { WorkflowService } from './workflow.service';

@ApiTags('workflow')
@Controller('workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  @ApiOperation({ summary: '创建工作流' })
  create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ) {
    return this.workflowService.create(currentUser.id, createWorkflowDto);
  }

  @Get()
  @ApiOperation({ summary: '获取工作空间下的工作流列表' })
  findByWorkspace(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query() query: WorkflowQueryDto,
  ) {
    return this.workflowService.findByWorkspace(currentUser.id, query);
  }

  @Get(':workflowId')
  @ApiOperation({ summary: '获取工作流详情' })
  findOne(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.workflowService.findOneForUser(currentUser.id, workflowId);
  }

  @Patch(':workflowId')
  @ApiOperation({ summary: '更新工作流基础信息' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ) {
    return this.workflowService.update(
      currentUser.id,
      workflowId,
      updateWorkflowDto,
    );
  }

  @Put(':workflowId/graph')
  @ApiOperation({ summary: '保存工作流草稿图' })
  saveGraph(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() saveWorkflowGraphDto: SaveWorkflowGraphDto,
  ) {
    return this.workflowService.saveGraph(
      currentUser.id,
      workflowId,
      saveWorkflowGraphDto,
    );
  }

  @Post(':workflowId/publish')
  @ApiOperation({ summary: '发布工作流' })
  publish(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() publishWorkflowDto: PublishWorkflowDto,
  ) {
    return this.workflowService.publish(
      currentUser.id,
      workflowId,
      publishWorkflowDto,
    );
  }

  @Get(':workflowId/versions')
  @ApiOperation({ summary: '获取工作流发布版本列表' })
  findVersions(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.workflowService.findVersions(currentUser.id, workflowId);
  }
}
