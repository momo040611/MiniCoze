import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [PublishController],
  providers: [PublishService],
})
export class PublishModule {}
