import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';

@Module({
  controllers: [WorkspaceController, MemberController],
  providers: [WorkspaceService, WorkspaceAccessService, MemberService],
  exports: [WorkspaceAccessService],
})
export class WorkspaceModule {}
