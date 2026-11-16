import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
