import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import type { UploadedFile as UploadedFileType } from '../file/types/uploaded-file.type';
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

  @Post('agents/:slug/files/upload')
  @ApiOperation({ summary: '公开 Agent 聊天附件上传' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 52428800,
        files: 1,
      },
    }),
  )
  uploadChatAttachment(
    @Param('slug') slug: string,
    @UploadedFile() file: UploadedFileType | undefined,
  ) {
    return this.publicAgentService.uploadWebChatAttachment(slug, file);
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
