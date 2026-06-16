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
import { CreateModelProviderDto } from './dto/create-model-provider.dto';
import { UpdateModelProviderDto } from './dto/update-model-provider.dto';
import { ModelConnectionTestService } from './model-connection-test.service';
import { ModelProviderService } from './model-provider.service';

@ApiTags('Model Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/model-providers')
// 模型服务 Provider 管理接口：负责配置服务地址、服务类型和凭证引用。
export class ModelProviderController {
  constructor(
    private readonly modelProviderService: ModelProviderService,
    private readonly modelConnectionTestService: ModelConnectionTestService,
  ) {}

  @Get()
  @ApiOperation({ summary: '查询工作区模型服务列表' })
  list(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.modelProviderService.list(currentUser.id, workspaceId);
  }

  @Post()
  @ApiOperation({ summary: '创建工作区模型服务' })
  create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateModelProviderDto,
  ) {
    return this.modelProviderService.create(currentUser.id, workspaceId, dto);
  }

  @Get(':providerId')
  @ApiOperation({ summary: '查询模型服务详情' })
  get(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('providerId') providerId: string,
  ) {
    return this.modelProviderService.get(
      currentUser.id,
      workspaceId,
      providerId,
    );
  }

  @Patch(':providerId')
  @ApiOperation({ summary: '更新模型服务配置' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('providerId') providerId: string,
    @Body() dto: UpdateModelProviderDto,
  ) {
    return this.modelProviderService.update(
      currentUser.id,
      workspaceId,
      providerId,
      dto,
    );
  }

  @Delete(':providerId')
  @ApiOperation({ summary: '删除未被模型引用的模型服务' })
  remove(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('providerId') providerId: string,
  ) {
    return this.modelProviderService.remove(
      currentUser.id,
      workspaceId,
      providerId,
    );
  }

  @Post(':providerId/test')
  @ApiOperation({ summary: '测试模型服务连接状态' })
  test(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('providerId') providerId: string,
  ) {
    return this.modelConnectionTestService.testProvider(
      currentUser.id,
      workspaceId,
      providerId,
    );
  }

  @Post(':providerId/sync-models')
  @ApiOperation({ summary: '从模型服务同步可用模型列表' })
  syncModels(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('providerId') providerId: string,
  ) {
    return this.modelConnectionTestService.syncModels(
      currentUser.id,
      workspaceId,
      providerId,
    );
  }
}
