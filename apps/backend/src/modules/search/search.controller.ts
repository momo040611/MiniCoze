import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('workspaces/:workspaceId/search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: '全局搜索工作空间内的资产（智能体/工作流/知识库/对话）' })
  @ApiOkResponse({ description: '返回四类资产的搜索结果分组' })
  search(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Query('q') q?: string,
  ) {
    return this.searchService.search(currentUser.id, workspaceId, q ?? '');
  }
}
