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
import { AgentWorkflowBindingService } from './agent-workflow-binding.service';
import { ReplaceAgentWorkflowBindingsDto } from './dto/replace-agent-workflow-bindings.dto';
import { UpdateAgentWorkflowBindingDto } from './dto/update-agent-workflow-binding.dto';

@ApiTags('agent-workflows')
@Controller('agents/:agentId/workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentWorkflowBindingController {
  constructor(
    private readonly agentWorkflowBindingService: AgentWorkflowBindingService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取 Agent 已绑定工作流' })
  list(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
  ) {
    return this.agentWorkflowBindingService.listForAgent(
      currentUser.id,
      agentId,
    );
  }

  @Put()
  @ApiOperation({ summary: '全量替换 Agent 工作流绑定' })
  replace(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Body() dto: ReplaceAgentWorkflowBindingsDto,
  ) {
    return this.agentWorkflowBindingService.replaceForAgent(
      currentUser.id,
      agentId,
      dto,
    );
  }

  @Patch(':bindingId')
  @ApiOperation({ summary: '更新单条 Agent 工作流绑定' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Param('bindingId') bindingId: string,
    @Body() dto: UpdateAgentWorkflowBindingDto,
  ) {
    return this.agentWorkflowBindingService.updateBinding(
      currentUser.id,
      agentId,
      bindingId,
      dto,
    );
  }
}
