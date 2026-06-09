import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceQueryDto } from './dto/workspace-query.dto';
import { WorkspaceService } from './workspace.service';

@ApiTags('workspace')
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @ApiOperation({ summary: '创建工作空间' })
  create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() createWorkspaceDto: CreateWorkspaceDto,
  ) {
    return this.workspaceService.create(currentUser.id, createWorkspaceDto);
  }

  @Get()
  @ApiOperation({ summary: '获取当前用户加入的工作空间列表' })
  findMyWorkspaces(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query() query: WorkspaceQueryDto,
  ) {
    return this.workspaceService.findMyWorkspaces(currentUser.id, query);
  }

  @Get(':workspaceId')
  @ApiOperation({ summary: '获取工作空间详情' })
  findOne(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaceService.findOneForUser(currentUser.id, workspaceId);
  }

  @Get(':workspaceId/dashboard')
  @ApiOperation({ summary: '获取工作空间仪表盘摘要' })
  getDashboardSummary(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaceService.getDashboardSummary(currentUser.id, workspaceId);
  }

  @Patch(':workspaceId')
  @ApiOperation({ summary: '更新工作空间' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.update(
      currentUser.id,
      workspaceId,
      updateWorkspaceDto,
    );
  }

  @Delete(':workspaceId')
  @ApiOperation({ summary: '删除工作空间' })
  remove(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaceService.remove(currentUser.id, workspaceId);
  }
}
