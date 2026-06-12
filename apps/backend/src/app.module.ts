import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { PublicAgentModule } from './modules/public-agent/public-agent.module';
import { PublicWorkflowModule } from './modules/public-workflow/public-workflow.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { AgentRuntimeModule } from './modules/agent-runtime/agent-runtime.module';
import { PluginModule } from './modules/plugins/plugin.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
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
    PublicAgentModule,
    PublicWorkflowModule,
    AiGatewayModule,
    AgentRuntimeModule,
    PluginModule,
    DashboardModule,
  ],
})
export class AppModule {}
