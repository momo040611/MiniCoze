import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkspaceModule } from '../workspace/workspace.module';
import { KnowledgeBaseController } from './bases/knowledge-base.controller';
import { KnowledgeBaseService } from './bases/knowledge-base.service';
import { KnowledgeDocumentController } from './documents/knowledge-document.controller';
import { KnowledgeDocumentService } from './documents/knowledge-document.service';
import { createEmbedder } from './embedding/embedder.factory';
import { EMBEDDER_TOKEN } from './embedding/embedder.interface';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { LocalDiskStorage } from './uploads/local-disk.storage';
import { UploadStageController } from './uploads/upload-stage.controller';
import { UploadStageService } from './uploads/upload-stage.service';
import { UPLOAD_STORAGE_TOKEN } from './uploads/upload-storage.interface';

@Module({
  imports: [ConfigModule, WorkspaceModule],
  controllers: [
    KnowledgeController,
    KnowledgeBaseController,
    KnowledgeDocumentController,
    UploadStageController,
  ],
  providers: [
    KnowledgeService,
    KnowledgeBaseService,
    KnowledgeDocumentService,
    UploadStageService,
    {
      provide: UPLOAD_STORAGE_TOKEN,
      useClass: LocalDiskStorage,
    },
    {
      provide: EMBEDDER_TOKEN,
      useFactory: createEmbedder,
      inject: [ConfigService],
    },
  ],
})
export class KnowledgeModule {}
