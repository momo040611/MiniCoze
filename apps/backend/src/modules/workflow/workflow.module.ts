import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
})
export class WorkflowModule {}
