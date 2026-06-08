import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FilePurpose } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { FileQueryDto } from './dto/file-query.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileService } from './file.service';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import type { UploadedFile as UploadedFileType } from './types/uploaded-file.type';

@ApiTags('file')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '上传文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'purpose'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        purpose: {
          type: 'string',
          enum: Object.values(FilePurpose),
        },
        workspaceId: {
          type: 'string',
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
  upload(
    @CurrentUserInfo() currentUser: CurrentUser,
    @UploadedFile() file: UploadedFileType | undefined,
    @Body() uploadFileDto: UploadFileDto,
  ) {
    return this.fileService.upload(currentUser.id, file, uploadFileDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取文件列表' })
  findAll(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query() query: FileQueryDto,
  ) {
    return this.fileService.findAllForUser(currentUser.id, query);
  }

  @Get(':fileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取文件详情' })
  findOne(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('fileId') fileId: string,
  ) {
    return this.fileService.findOneForUser(fileId, currentUser);
  }

  @Get(':fileId/content')
  @UseGuards(OptionalJwtAuthGuard)
  @SkipResponseWrap()
  @ApiBearerAuth()
  @ApiOperation({ summary: '访问文件内容' })
  async getContent(
    @Param('fileId') fileId: string,
    @Req() request: Request & { user?: CurrentUser | null },
    @Res({ passthrough: true }) response: Response,
  ) {
    const { fileAsset, stream, size } = await this.fileService.getContent(
      fileId,
      request.user,
    );

    response.setHeader('Content-Type', fileAsset.mimeType);
    response.setHeader('Content-Length', String(size));
    response.setHeader(
      'Content-Disposition',
      this.createInlineDisposition(fileAsset.originalName),
    );

    return new StreamableFile(stream);
  }

  @Delete(':fileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除文件' })
  remove(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('fileId') fileId: string,
  ) {
    return this.fileService.remove(currentUser.id, fileId);
  }

  private createInlineDisposition(fileName: string) {
    const encodedFileName = encodeURIComponent(fileName);
    const fallbackFileName = fileName.replace(/[^\x20-\x7E]/g, '_');

    return `inline; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`;
  }
}
