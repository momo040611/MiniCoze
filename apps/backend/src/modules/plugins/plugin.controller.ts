import {
  Body,
  Controller,
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
import { CreatePluginDto } from './dto/create-plugin.dto';
import { CreatePluginToolDto } from './dto/create-plugin-tool.dto';
import { InstallMarketPluginDto } from './dto/install-market-plugin.dto';
import { PluginInvocationQueryDto } from './dto/plugin-invocation-query.dto';
import { PluginQueryDto } from './dto/plugin-query.dto';
import { TestPluginToolDto } from './dto/test-plugin-tool.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';
import { UpdatePluginToolDto } from './dto/update-plugin-tool.dto';
import { PluginInvocationService } from './plugin-invocation.service';
import { PluginService } from './plugin.service';
import { PluginToolService } from './plugin-tool.service';

@ApiTags('plugins')
@Controller('plugins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PluginController {
  constructor(
    private readonly pluginService: PluginService,
    private readonly pluginToolService: PluginToolService,
    private readonly pluginInvocationService: PluginInvocationService,
  ) {}

  @Post()
  @ApiOperation({ summary: '创建插件' })
  create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() dto: CreatePluginDto,
  ) {
    return this.pluginService.create(currentUser.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '获取插件列表' })
  findByWorkspace(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query() query: PluginQueryDto,
  ) {
    return this.pluginService.findByWorkspace(currentUser.id, query);
  }

  // 插件市场路由必须放在 :pluginId 路由之前，否则 'market' 会被参数路由吞掉。
  @Get('market')
  @ApiOperation({ summary: '获取插件市场目录（含工作区安装状态）' })
  getMarket(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.pluginService.getMarketCatalog(currentUser.id, workspaceId);
  }

  @Post('market/install')
  @ApiOperation({ summary: '从插件市场安装插件到工作区' })
  installMarketPlugin(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() dto: InstallMarketPluginDto,
  ) {
    return this.pluginService.installMarketPlugin(
      currentUser.id,
      dto.workspaceId,
      dto.code,
    );
  }

  @Get(':pluginId')
  @ApiOperation({ summary: '获取插件详情' })
  findOne(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
  ) {
    console.log('获取插件详情');
    return this.pluginService.findOneForUser(currentUser.id, pluginId);
  }

  @Get(':pluginId/invocations')
  @ApiOperation({ summary: '获取插件调用日志' })
  findInvocations(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
    @Query() query: PluginInvocationQueryDto,
  ) {
    return this.pluginInvocationService.findByPlugin(
      currentUser.id,
      pluginId,
      query,
    );
  }

  @Patch(':pluginId')
  @ApiOperation({ summary: '更新插件' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
    @Body() dto: UpdatePluginDto,
  ) {
    return this.pluginService.update(currentUser.id, pluginId, dto);
  }

  @Post(':pluginId/activate')
  @ApiOperation({ summary: '启用插件' })
  activate(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
  ) {
    return this.pluginService.activate(currentUser.id, pluginId);
  }

  @Post(':pluginId/disable')
  @ApiOperation({ summary: '停用插件' })
  disable(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
  ) {
    return this.pluginService.disable(currentUser.id, pluginId);
  }

  @Post(':pluginId/tools')
  @ApiOperation({ summary: '创建插件工具' })
  createTool(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
    @Body() dto: CreatePluginToolDto,
  ) {
    return this.pluginToolService.create(currentUser.id, pluginId, dto);
  }

  @Patch(':pluginId/tools/:toolId')
  @ApiOperation({ summary: '更新插件工具' })
  updateTool(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
    @Param('toolId') toolId: string,
    @Body() dto: UpdatePluginToolDto,
  ) {
    return this.pluginToolService.update(currentUser.id, pluginId, toolId, dto);
  }

  @Post(':pluginId/tools/:toolId/test')
  @ApiOperation({ summary: '测试插件工具' })
  testTool(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('pluginId') pluginId: string,
    @Param('toolId') toolId: string,
    @Body() dto: TestPluginToolDto,
  ) {
    return this.pluginToolService.test(currentUser.id, pluginId, toolId, dto);
  }
}
