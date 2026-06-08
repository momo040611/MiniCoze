import {
  Body,
  Controller,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../../shared/types/current-user.type';
import { ReindexResponseDto } from './dto/reindex-response.dto';
import { RetrieveRequestDto } from './dto/retrieve-request.dto';
import {
  RetrievedChunkDto,
  RetrieveResponseDto,
} from './dto/retrieve-response.dto';
import { RetrievalService } from './retrieval.service';

const TRUTHY = new Set(['1', 'true', 'TRUE', 'True', 'yes', 'YES']);

@ApiTags('knowledge')
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RetrievalController {
  constructor(private readonly service: RetrievalService) {}

  @Post('retrieval')
  @ApiOperation({
    summary: '多知识库语义检索（cosine similarity + topK + minScore）',
  })
  async retrieve(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() dto: RetrieveRequestDto,
  ): Promise<RetrieveResponseDto> {
    const results = await this.service.search(currentUser.id, {
      knowledgeBaseIds: dto.knowledgeBaseIds,
      query: dto.query,
      topK: dto.topK,
      minScore: dto.minScore,
    });
    return { results: results };
  }

  @Post('bases/:id/reindex')
  @ApiOperation({
    summary: '按知识库回填向量；force=true 会先清空再写，默认增量补缺',
  })
  async reindex(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('id') knowledgeBaseId: string,
    @Query('force') force?: string,
  ): Promise<ReindexResponseDto> {
    const forceFlag = typeof force === 'string' && TRUTHY.has(force);
    return this.service.reindexKnowledgeBase(
      currentUser.id,
      knowledgeBaseId,
      forceFlag,
    );
  }
}
