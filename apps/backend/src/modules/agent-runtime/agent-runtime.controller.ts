import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { AgentRunQueryDto } from './dto/agent-run-query.dto';
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
    // 客户端断开（关页面/停止按钮断流）时中止运行，避免后端继续空烧 token。
    const disconnectController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        disconnectController.abort('canceled');
      }
    });

    const events = this.agentRuntimeService.run({
      ...dto,
      userId: currentUser.id,
      signal: disconnectController.signal,
    });

    await writeRuntimeEventStream(res, events);
  }

  @Get()
  @ApiOperation({ summary: 'List agent run records' })
  listRuns(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query() query: AgentRunQueryDto,
  ) {
    return this.agentRuntimeService.listRuns(currentUser.id, query);
  }

  @Get(':runId')
  @ApiOperation({ summary: 'Get an agent run record detail' })
  getRun(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('runId') runId: string,
  ) {
    return this.agentRuntimeService.getRun(currentUser.id, runId);
  }

  @Post(':runId/cancel')
  @ApiOperation({ summary: 'Cancel a running agent run' })
  async cancelRun(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('runId') runId: string,
  ) {
    await this.agentRuntimeService.cancelRun(currentUser.id, runId);
    return { success: true };
  }
}
