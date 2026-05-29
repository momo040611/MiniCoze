import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../../shared/types/current-user.type';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { KnowledgeBaseService } from './knowledge-base.service';

@ApiTags('knowledge')
@Controller('knowledge/bases')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeBaseController {
  constructor(private readonly service: KnowledgeBaseService) {}

  @Post()
  @ApiOperation({ summary: '创建知识库' })
  create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() dto: CreateKnowledgeBaseDto,
  ) {
    return this.service.create(currentUser.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '列出某 workspace 下我可见的知识库' })
  findByWorkspace(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.service.findByWorkspace(currentUser.id, workspaceId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除知识库（级联删除文档与切片）' })
  remove(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.service.remove(currentUser.id, id);
  }
}
