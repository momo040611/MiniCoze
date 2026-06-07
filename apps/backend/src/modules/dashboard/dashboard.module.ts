import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
