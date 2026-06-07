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
import { ChunkWithFileDto } from './dto/chunk-with-file.dto';
import { KnowledgeService } from './knowledge.service';

@ApiTags('knowledge')
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('chunk')
  @ApiOperation({
    summary: '切分预览（基于通用文件 fileId，不入库）',
    description:
      '先调用 POST /files/upload 上传文件（purpose=KNOWLEDGE_DOCUMENT）拿到 FileAsset.id，再用 fileId + 切分配置预览 chunks。可重复调以调试切分参数。',
  })
  @ApiResponse({ status: HttpStatus.OK, type: ChunkDocumentResponseDto })
  async chunk(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() dto: ChunkWithFileDto,
  ): Promise<ChunkDocumentResponseDto> {
    const result = await this.knowledgeService.chunkDocument(
      currentUser.id,
      dto.fileId,
      dto.config,
    );
    return result as ChunkDocumentResponseDto;
  }
}
