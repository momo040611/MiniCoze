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
import { CreateWorkspaceModelDto } from './dto/create-workspace-model.dto';
import { UpdateWorkspaceModelDto } from './dto/update-workspace-model.dto';
import { WorkspaceModelService } from './workspace-model.service';

@ApiTags('Workspace Models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/models')
// 工作区模型管理接口：负责维护可选模型、默认模型和引用关系查询。
export class WorkspaceModelController {
  constructor(private readonly workspaceModelService: WorkspaceModelService) {}

  @Get()
  @ApiOperation({ summary: '查询工作区模型列表' })
  list(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaceModelService.list(currentUser.id, workspaceId);
  }

  @Post()
  @ApiOperation({ summary: '手动创建工作区模型' })
  create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateWorkspaceModelDto,
  ) {
    return this.workspaceModelService.create(currentUser.id, workspaceId, dto);
  }

  @Get(':modelId')
  @ApiOperation({ summary: '查询工作区模型详情' })
  get(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('modelId') modelId: string,
  ) {
    return this.workspaceModelService.get(currentUser.id, workspaceId, modelId);
  }

  @Patch(':modelId')
  @ApiOperation({ summary: '更新工作区模型配置' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('modelId') modelId: string,
    @Body() dto: UpdateWorkspaceModelDto,
  ) {
    return this.workspaceModelService.update(
      currentUser.id,
      workspaceId,
      modelId,
      dto,
    );
  }

  @Delete(':modelId')
  @ApiOperation({ summary: '删除未被引用的工作区模型' })
  remove(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('modelId') modelId: string,
  ) {
    return this.workspaceModelService.remove(
      currentUser.id,
      workspaceId,
      modelId,
    );
  }

  @Post(':modelId/set-default')
  @ApiOperation({ summary: '设置工作区默认运行模型' })
  setDefault(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('modelId') modelId: string,
  ) {
    return this.workspaceModelService.setDefault(
      currentUser.id,
      workspaceId,
      modelId,
    );
  }

  @Get(':modelId/references')
  @ApiOperation({ summary: '查询模型被 Agent、默认设置或工作流引用的情况' })
  getReferences(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('modelId') modelId: string,
  ) {
    return this.workspaceModelService.getReferences(
      currentUser.id,
      workspaceId,
      modelId,
    );
  }
}
