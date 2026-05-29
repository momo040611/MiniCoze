import { Body, Controller, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { ChunkDocumentResponseDto } from './dto/chunk-document-response.dto';
import { KnowledgeService } from './knowledge.service';
import { ChunkWithStageDto } from './uploads/dto/chunk-with-stage.dto';

// 兼容旧错误码引用，避免未使用 import 报错。
void HttpStatus;

@ApiTags('knowledge')
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('chunk')
  @ApiOperation({
    summary: '切分预览（基于 stage fileId，不入库）',
    description:
      '先调用 POST /knowledge/uploads 上传文件拿到 fileId，再用 fileId + 切分配置预览 chunks。可重复调以调试切分参数。',
  })
  @ApiResponse({ status: HttpStatus.OK, type: ChunkDocumentResponseDto })
  async chunk(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() dto: ChunkWithStageDto,
  ): Promise<ChunkDocumentResponseDto> {
    const result = await this.knowledgeService.chunkDocument(
      currentUser.id,
      dto.fileId,
      dto.config,
    );
    return result as ChunkDocumentResponseDto;
  }
}
