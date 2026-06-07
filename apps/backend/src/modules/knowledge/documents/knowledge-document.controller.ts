import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../../shared/types/current-user.type';
import { ChunkWithFileDto } from '../dto/chunk-with-file.dto';
import { ToggleChunkDto } from './dto/toggle-chunk.dto';
import { UpdateChunkDto } from './dto/update-chunk.dto';
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

  @Get('documents/:documentId/chunks/page')
  @ApiOperation({ summary: '分页获取文档切片列表' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  listChunksPaginated(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('documentId') documentId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.listChunksByDocumentPaginated(
      currentUser.id,
      documentId,
      query.page,
      query.pageSize,
    );
  }

  @Put('documents/:documentId/chunks/:index')
  @ApiOperation({ summary: '编辑切片内容' })
  updateChunk(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('documentId') documentId: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() dto: UpdateChunkDto,
  ) {
    return this.service.updateChunk(
      currentUser.id,
      documentId,
      index,
      dto.content,
    );
  }

  @Delete('documents/:documentId/chunks/:index')
  @ApiOperation({ summary: '删除切片' })
  deleteChunk(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('documentId') documentId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.service.deleteChunk(currentUser.id, documentId, index);
  }

  @Patch('documents/:documentId/chunks/:index/enabled')
  @ApiOperation({ summary: '启用/禁用切片' })
  toggleChunk(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('documentId') documentId: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() dto: ToggleChunkDto,
  ) {
    return this.service.toggleChunk(
      currentUser.id,
      documentId,
      index,
      dto.enabled,
    );
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
