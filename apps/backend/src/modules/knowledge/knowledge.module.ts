import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileModule } from '../file/file.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { KnowledgeBaseController } from './bases/knowledge-base.controller';
import { KnowledgeBaseService } from './bases/knowledge-base.service';
import { KnowledgeDocumentController } from './documents/knowledge-document.controller';
import { KnowledgeDocumentService } from './documents/knowledge-document.service';
import { createEmbedder } from './embedding/embedder.factory';
import { EMBEDDER_TOKEN } from './embedding/embedder.interface';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { RetrievalService } from './retrieval/retrieval.service';

@Module({
  imports: [ConfigModule, WorkspaceModule, FileModule],
  controllers: [
    KnowledgeController,
    KnowledgeBaseController,
    KnowledgeDocumentController,
  ],
  providers: [
    KnowledgeService,
    KnowledgeBaseService,
    KnowledgeDocumentService,
    RetrievalService,
    {
      provide: EMBEDDER_TOKEN,
      useFactory: createEmbedder,
      inject: [ConfigService],
    },
  ],
  exports: [RetrievalService],
})
export class KnowledgeModule {}
