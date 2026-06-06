import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { writeRuntimeEventStream } from '../agent-runtime/runtime-event-stream.writer';
import { PublicAgentChatDto } from './dto/public-agent-chat.dto';
import { PublicAgentService } from './public-agent.service';

@ApiTags('public-agent')
@Controller('public')
export class PublicAgentController {
  constructor(private readonly publicAgentService: PublicAgentService) {}

  @Get('agents/:slug')
  @ApiOperation({ summary: '获取公开 Agent 基础信息' })
  getPublicAgent(@Param('slug') slug: string) {
    return this.publicAgentService.getPublicAgentBySlug(slug);
  }

  @Post('agents/:slug/chat/stream')
  @SkipResponseWrap()
  @ApiOperation({ summary: '公开 WEB Agent 流式对话入口（预留）' })
  async streamWebChat(
    @Param('slug') slug: string,
    @Body() dto: PublicAgentChatDto,
    @Res() res: Response,
  ) {
    const events = await this.publicAgentService.createWebChatStream(slug, dto);
    await writeRuntimeEventStream(res, events);
  }

  @Post('agent-runs/stream')
  @SkipResponseWrap()
  @ApiOperation({ summary: '公开 API Agent 流式运行入口（预留）' })
  async streamApiRun(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: PublicAgentChatDto,
    @Res() res: Response,
  ) {
    const events = await this.publicAgentService.createApiRunStream(
      authorization,
      dto,
    );
    await writeRuntimeEventStream(res, events);
  }
}
