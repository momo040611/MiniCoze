import { Module } from '@nestjs/common';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';
import { FileModule } from '../file/file.module';
import { PublicAgentController } from './public-agent.controller';
import { PublicAgentService } from './public-agent.service';

@Module({
  imports: [AgentRuntimeModule, FileModule],
  controllers: [PublicAgentController],
  providers: [PublicAgentService],
})
export class PublicAgentModule {}
