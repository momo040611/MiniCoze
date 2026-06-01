import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AgentPluginBindingController } from './agent-plugin-binding.controller';
import { BingWebSearchClient } from './builtin/bing-web-search.client';
import { ImageUnderstandingClient } from './builtin/image-understanding.client';
import { LinkReaderClient } from './builtin/link-reader.client';
import { AgentPluginBindingService } from './agent-plugin-binding.service';
import { BuiltinPluginExecutor } from './executors/builtin-plugin.executor';
import { HttpPluginExecutor } from './executors/http-plugin.executor';
import { PluginMaskerService } from './mask/plugin-masker.service';
import { PluginController } from './plugin.controller';
import { PluginCredentialService } from './plugin-credential.service';
import { PluginExecutionService } from './plugin-execution.service';
import { PluginInvocationService } from './plugin-invocation.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginResolverService } from './plugin-resolver.service';
import { PluginService } from './plugin.service';
import { PluginToolService } from './plugin-tool.service';
import { PluginSchemaValidator } from './validators/plugin-schema.validator';

@Module({
  imports: [WorkspaceModule, FileModule],
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
    PluginSchemaValidator,
    PluginMaskerService,
    BingWebSearchClient,
    ImageUnderstandingClient,
    LinkReaderClient,
    BuiltinPluginExecutor,
    HttpPluginExecutor,
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
    PluginSchemaValidator,
    PluginMaskerService,
    BingWebSearchClient,
    ImageUnderstandingClient,
    LinkReaderClient,
    BuiltinPluginExecutor,
    HttpPluginExecutor,
  ],
})
export class PluginModule {}
