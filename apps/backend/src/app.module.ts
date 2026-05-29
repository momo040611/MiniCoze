import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { AgentModule } from './modules/single-agent/agent.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { FileModule } from './modules/file/file.module';
import { PublishModule } from './modules/publish/publish.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { AgentRuntimeModule } from './modules/agent-runtime/agent-runtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    UserModule,
    WorkspaceModule,
    AgentModule,
    ConversationModule,
    WorkflowModule,
    KnowledgeModule,
    FileModule,
    PublishModule,
    AiGatewayModule,
    AgentRuntimeModule,
  ],
})
export class AppModule {}
