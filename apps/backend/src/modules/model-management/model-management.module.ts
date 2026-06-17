import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { CredentialsModule } from '../credentials/credentials.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ModelConnectionTestService } from './model-connection-test.service';
import { ModelProviderController } from './model-provider.controller';
import { ModelProviderService } from './model-provider.service';
import { ModelResolverService } from './model-resolver.service';
import { WorkspaceModelController } from './workspace-model.controller';
import { WorkspaceModelService } from './workspace-model.service';

// 模型管理模块聚合 Provider、WorkspaceModel、运行时解析和连接测试能力。
// 其他运行模块只需要依赖导出的 ModelResolverService / WorkspaceModelService。
@Module({
  imports: [WorkspaceModule, CredentialsModule, AiGatewayModule],
  controllers: [ModelProviderController, WorkspaceModelController],
  providers: [
    ModelProviderService,
    WorkspaceModelService,
    ModelConnectionTestService,
    ModelResolverService,
  ],
  exports: [ModelProviderService, WorkspaceModelService, ModelResolverService],
})
export class ModelManagementModule {}
