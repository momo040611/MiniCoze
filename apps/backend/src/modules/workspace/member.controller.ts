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
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberService } from './member.service';

@ApiTags('workspace-members')
@Controller('workspaces/:workspaceId/members')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get()
  @ApiOperation({ summary: '获取工作区成员列表' })
  getMembers(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.memberService.getMembers(currentUser.id, workspaceId);
  }

  @Post()
  @ApiOperation({ summary: '添加工作区成员' })
  addMember(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.memberService.addMember(
      currentUser.id,
      workspaceId,
      dto.email,
      dto.role,
    );
  }

  @Patch(':userId')
  @ApiOperation({ summary: '修改成员角色' })
  updateMemberRole(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.memberService.updateMemberRole(
      currentUser.id,
      workspaceId,
      userId,
      dto.role,
    );
  }

  @Delete(':userId')
  @ApiOperation({ summary: '移除工作区成员' })
  removeMember(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    return this.memberService.removeMember(
      currentUser.id,
      workspaceId,
      userId,
    );
  }
}
