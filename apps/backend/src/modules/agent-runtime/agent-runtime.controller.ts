import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { AgentRuntimeService } from './agent-runtime.service';
import { writeRuntimeEventStream } from './runtime-event-stream.writer';
import { RunAgentDto } from './runtime/dto/run-agent.dto';

@ApiTags('agent-runtime')
@Controller('agent-runs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentRuntimeController {
  constructor(private readonly agentRuntimeService: AgentRuntimeService) {}

  @Post('stream')
  @SkipResponseWrap()
  @ApiOperation({ summary: 'Run an agent and stream runtime events' })
  async stream(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() dto: RunAgentDto,
    @Res() res: Response,
  ) {
    const events = this.agentRuntimeService.run({
      ...dto,
      userId: currentUser.id,
    });

    await writeRuntimeEventStream(res, events);
  }
}
