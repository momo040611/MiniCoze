import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { ReplaceAgentPluginBindingsDto } from './dto/replace-agent-plugin-bindings.dto';
import { UpdateAgentPluginBindingDto } from './dto/update-agent-plugin-binding.dto';
import { AgentPluginBindingService } from './agent-plugin-binding.service';

@ApiTags('agent-plugins')
@Controller('agents/:agentId/plugins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentPluginBindingController {
  constructor(
    private readonly agentPluginBindingService: AgentPluginBindingService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取 Agent 已绑定插件' })
  list(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
  ) {
    return this.agentPluginBindingService.listForAgent(currentUser.id, agentId);
  }

  @Put()
  @ApiOperation({ summary: '全量替换 Agent 插件绑定' })
  replace(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Body() dto: ReplaceAgentPluginBindingsDto,
  ) {
    return this.agentPluginBindingService.replaceForAgent(
      currentUser.id,
      agentId,
      dto,
    );
  }

  @Patch(':bindingId')
  @ApiOperation({ summary: '更新单条 Agent 插件绑定' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Param('bindingId') bindingId: string,
    @Body() dto: UpdateAgentPluginBindingDto,
  ) {
    return this.agentPluginBindingService.updateBinding(
      currentUser.id,
      agentId,
      bindingId,
      dto,
    );
  }
}
