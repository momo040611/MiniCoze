import { Body, Controller, Headers, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { PublicWorkflowRunDto } from './dto/public-workflow-run.dto';
import { PublicWorkflowService } from './public-workflow.service';

@ApiTags('public-workflow')
@Controller('public/workflow-runs')
export class PublicWorkflowController {
  constructor(private readonly publicWorkflowService: PublicWorkflowService) {}

  @Post()
  @ApiOperation({ summary: '公开 API 同步运行工作流' })
  run(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: PublicWorkflowRunDto,
  ) {
    return this.publicWorkflowService.run(authorization, dto);
  }

  @Post('stream')
  @SkipResponseWrap()
  @ApiOperation({ summary: '公开 API 流式运行工作流' })
  async runStream(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: PublicWorkflowRunDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: unknown): void => {
      if (
        event &&
        typeof event === 'object' &&
        'type' in event &&
        typeof event.type === 'string'
      ) {
        res.write(`event: ${event.type}\n`);
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await this.publicWorkflowService.run(authorization, dto, send);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message })}\n\n`);
    } finally {
      res.end();
    }
  }
}
