import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ErrorCode } from '../../../common/constants/error-code';
import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { decodeMultipartFilename } from '../../../common/utils/multipart-filename';
import type { CurrentUser } from '../../../shared/types/current-user.type';
import {
  SUPPORTED_EXTENSIONS,
  type SupportedExtension,
} from '../chunking/types';
import { UploadStageService } from './upload-stage.service';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags('knowledge')
@Controller('knowledge/uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadStageController {
  constructor(private readonly service: UploadStageService) {}

  @Post()
  @ApiOperation({
    summary: '上传文档到 stage（拿到 fileId 后用于切分预览/入库）',
    description:
      'multipart/form-data：file（txt/md，<=10MB）。文件落本地磁盘 + DB 元数据，TTL 24h。',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BusinessException(
        'missing file field',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    const originalName = decodeMultipartFilename(file.originalname);
    const ext = this.extractExtension(originalName);

    return this.service.createStage(
      currentUser.id,
      originalName,
      ext,
      file.buffer,
    );
  }

  @Get(':fileId')
  @ApiOperation({ summary: '查 stage 元信息' })
  get(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('fileId') fileId: string,
  ) {
    return this.service.getForUser(currentUser.id, fileId);
  }

  @Delete(':fileId')
  @ApiOperation({ summary: '用户主动取消上传 stage' })
  remove(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('fileId') fileId: string,
  ) {
    return this.service.removeForUser(currentUser.id, fileId);
  }

  private extractExtension(filename: string): SupportedExtension {
    const idx = filename.lastIndexOf('.');
    if (idx === -1 || idx === filename.length - 1) {
      throw new BusinessException(
        'file has no extension',
        ErrorCode.KnowledgeFileTypeUnsupported,
      );
    }
    const ext = filename.slice(idx + 1).toLowerCase();
    if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
      throw new BusinessException(
        `unsupported file extension: ${ext}`,
        ErrorCode.KnowledgeFileTypeUnsupported,
      );
    }
    return ext as SupportedExtension;
  }
}
