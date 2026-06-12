import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { PublicWorkflowController } from './public-workflow.controller';
import { PublicWorkflowService } from './public-workflow.service';

@Module({
  imports: [WorkflowModule],
  controllers: [PublicWorkflowController],
  providers: [PublicWorkflowService],
})
export class PublicWorkflowModule {}
