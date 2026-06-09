import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PublishChannelController } from './publish-channel.controller';
import { PublishChannelService } from './publish-channel.service';
import { PublishController } from './publish.controller';
import { PublishRecordService } from './publish-record.service';
import { PublishService } from './publish.service';
import { WorkflowPublishChannelController } from './workflow-publish-channel.controller';
import { WorkflowPublishController } from './workflow-publish.controller';
import { WorkflowPublishService } from './workflow-publish.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [
    PublishController,
    PublishChannelController,
    WorkflowPublishController,
    WorkflowPublishChannelController,
  ],
  providers: [
    PublishService,
    PublishChannelService,
    PublishRecordService,
    WorkflowPublishService,
  ],
  exports: [WorkflowPublishService],
})
export class PublishModule {}
