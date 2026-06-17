import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import { CredentialService } from './credential.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';

@ApiTags('Credentials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/credentials')
// 工作区凭证管理接口：只管理元信息和密钥写入，读取时永远不返回密钥。
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  @Get()
  @ApiOperation({ summary: '查询工作区凭证列表' })
  list(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.credentialService.list(currentUser.id, workspaceId);
  }

  @Post()
  @ApiOperation({ summary: '创建工作区凭证' })
  create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateCredentialDto,
  ) {
    return this.credentialService.create(currentUser.id, workspaceId, dto);
  }

  @Patch(':credentialId')
  @ApiOperation({ summary: '更新工作区凭证元信息或密钥' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('credentialId') credentialId: string,
    @Body() dto: UpdateCredentialDto,
  ) {
    return this.credentialService.update(
      currentUser.id,
      workspaceId,
      credentialId,
      dto,
    );
  }

  @Delete(':credentialId')
  @ApiOperation({ summary: '删除未被引用的工作区凭证' })
  remove(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('credentialId') credentialId: string,
  ) {
    return this.credentialService.remove(
      currentUser.id,
      workspaceId,
      credentialId,
    );
  }

  @Get(':credentialId/references')
  @ApiOperation({ summary: '查询凭证被哪些模型服务引用' })
  getReferences(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('credentialId') credentialId: string,
  ) {
    return this.credentialService.getReferences(
      currentUser.id,
      workspaceId,
      credentialId,
    );
  }
}
