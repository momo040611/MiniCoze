import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BindAgentToolsDto } from './dto/bind-agent-tools.dto';
import { TestToolDto } from './dto/test-tool.dto';
import { TogglePluginDto } from './dto/toggle-plugin.dto';
import { PluginService } from './plugin.service';

@ApiTags('plugin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PluginController {
  constructor(private readonly pluginService: PluginService) {}

  @Get('plugins')
  @ApiOperation({ summary: '获取插件列表' })
  findAll() {
    return this.pluginService.findAll();
  }

  @Get('plugins/:pluginId')
  @ApiOperation({ summary: '获取插件详情' })
  findOne(@Param('pluginId') pluginId: string) {
    return this.pluginService.findOne(pluginId);
  }

  @Patch('plugins/:pluginId/toggle')
  @ApiOperation({ summary: '启用或停用插件' })
  toggle(
    @Param('pluginId') pluginId: string,
    @Body() togglePluginDto: TogglePluginDto,
  ) {
    return this.pluginService.toggle(pluginId, togglePluginDto.enabled);
  }

  @Post('tools/:toolId/test')
  @ApiOperation({ summary: '测试插件工具' })
  testTool(@Param('toolId') toolId: string, @Body() testToolDto: TestToolDto) {
    return this.pluginService.testTool(toolId, testToolDto.params);
  }

  @Get('agents/:agentId/tools')
  @ApiOperation({ summary: '获取智能体工具绑定' })
  getAgentBinding(@Param('agentId') agentId: string) {
    return this.pluginService.getAgentBinding(agentId);
  }

  @Put('agents/:agentId/tools')
  @ApiOperation({ summary: '保存智能体工具绑定' })
  bindAgentTools(
    @Param('agentId') agentId: string,
    @Body() bindAgentToolsDto: BindAgentToolsDto,
  ) {
    return this.pluginService.bindAgentTools(agentId, bindAgentToolsDto.toolIds);
  }
}
