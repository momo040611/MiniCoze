import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('agent-plugins')
@Controller('agents/:agentId/plugins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentPluginBindingController {}
