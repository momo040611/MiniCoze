import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../../shared/types/current-user.type';
import { ChunkWithFileDto } from '../dto/chunk-with-file.dto';
import { KnowledgeDocumentService } from './knowledge-document.service';

@ApiTags('knowledge')
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeDocumentController {
  constructor(private readonly service: KnowledgeDocumentService) {}

  @Post('bases/:id/documents')
  @ApiOperation({
    summary: '通用文件 → 切分 → 向量化 → 入库（同步）',
    description:
      '基于已有 fileId（先调 POST /files/upload，purpose=KNOWLEDGE_DOCUMENT）。同步完成切分+向量化+事务入库；成功后保留 FileAsset。',
  })
  upload(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('id') knowledgeBaseId: string,
    @Body() dto: ChunkWithFileDto,
  ) {
    return this.service.chunkAndIngest(
      currentUser.id,
      knowledgeBaseId,
      dto.fileId,
      dto.config,
    );
  }

  @Get('bases/:id/documents')
  @ApiOperation({
    summary: '列出指定知识库下的文档（含 chunkConfig 用于回显）',
  })
  list(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('id') knowledgeBaseId: string,
  ) {
    return this.service
      .listByKnowledgeBase(currentUser.id, knowledgeBaseId)
      .then((list) => ({ list }));
  }

  @Get('documents/:id/chunks')
  @ApiOperation({
    summary: '查看某文档的全部切分内容（不含向量）',
  })
  listChunks(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.listChunksByDocument(currentUser.id, id);
  }

  @Delete('documents/:id')
  @ApiOperation({ summary: '删除文档（级联删除 chunks）' })
  remove(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.remove(currentUser.id, id);
  }
}
