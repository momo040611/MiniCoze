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
import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../../shared/types/current-user.type';
import { ReplaceAgentKnowledgeBindingsDto } from './dto/replace-agent-knowledge-bindings.dto';
import { UpdateAgentKnowledgeBindingDto } from './dto/update-agent-knowledge-binding.dto';
import { AgentKnowledgeBindingService } from './agent-knowledge-binding.service';

@ApiTags('agent-knowledges')
@Controller('agents/:agentId/knowledges')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentKnowledgeBindingController {
  constructor(
    private readonly agentKnowledgeBindingService: AgentKnowledgeBindingService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取 Agent 已绑定知识库' })
  list(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
  ) {
    return this.agentKnowledgeBindingService.listForAgent(
      currentUser.id,
      agentId,
    );
  }

  @Put()
  @ApiOperation({ summary: '全量替换 Agent 知识库绑定' })
  replace(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Body() dto: ReplaceAgentKnowledgeBindingsDto,
  ) {
    return this.agentKnowledgeBindingService.replaceForAgent(
      currentUser.id,
      agentId,
      dto,
    );
  }

  @Patch(':bindingId')
  @ApiOperation({ summary: '更新单条 Agent 知识库绑定' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('agentId') agentId: string,
    @Param('bindingId') bindingId: string,
    @Body() dto: UpdateAgentKnowledgeBindingDto,
  ) {
    return this.agentKnowledgeBindingService.updateBinding(
      currentUser.id,
      agentId,
      bindingId,
      dto,
    );
  }
}
