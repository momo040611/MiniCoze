import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PublishChannelController } from './publish-channel.controller';
import { PublishChannelService } from './publish-channel.service';
import { PublishController } from './publish.controller';
import { PublishRecordService } from './publish-record.service';
import { PublishService } from './publish.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [PublishController, PublishChannelController],
  providers: [PublishService, PublishChannelService, PublishRecordService],
})
export class PublishModule {}
