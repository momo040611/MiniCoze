import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CredentialController } from './credential.controller';
import { CredentialService } from './credential.service';
import { SecretService } from './secret.service';

// 凭证模块只暴露 Service 给其他后端模块使用，Controller 负责凭证管理 API。
@Module({
  imports: [WorkspaceModule],
  controllers: [CredentialController],
  providers: [CredentialService, SecretService],
  exports: [CredentialService, SecretService],
})
export class CredentialsModule {}
