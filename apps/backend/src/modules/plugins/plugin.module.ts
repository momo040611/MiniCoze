import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AgentPluginBindingController } from './agent-plugin-binding.controller';
import { AgentPluginBindingService } from './agent-plugin-binding.service';
import { PluginController } from './plugin.controller';
import { PluginCredentialService } from './plugin-credential.service';
import { PluginExecutionService } from './plugin-execution.service';
import { PluginInvocationService } from './plugin-invocation.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginResolverService } from './plugin-resolver.service';
import { PluginService } from './plugin.service';
import { PluginToolService } from './plugin-tool.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [PluginController, AgentPluginBindingController],
  providers: [
    PluginService,
    PluginToolService,
    AgentPluginBindingService,
    PluginCredentialService,
    PluginRegistryService,
    PluginExecutionService,
    PluginInvocationService,
    PluginResolverService,
  ],
  exports: [
    PluginService,
    PluginToolService,
    AgentPluginBindingService,
    PluginCredentialService,
    PluginRegistryService,
    PluginExecutionService,
    PluginInvocationService,
    PluginResolverService,
  ],
})
export class PluginModule {}
