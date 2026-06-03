import { Module } from '@nestjs/common';
import { PublicAgentController } from './public-agent.controller';
import { PublicAgentService } from './public-agent.service';

@Module({
  controllers: [PublicAgentController],
  providers: [PublicAgentService],
})
export class PublicAgentModule {}
