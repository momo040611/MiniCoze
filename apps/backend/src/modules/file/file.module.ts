import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { LocalStorageService } from './storage/local-storage.service';
import { FILE_STORAGE } from './storage/storage.interface';

@Module({
  imports: [WorkspaceModule],
  controllers: [FileController],
  providers: [
    FileService,
    OptionalJwtAuthGuard,
    LocalStorageService,
    {
      provide: FILE_STORAGE,
      useExisting: LocalStorageService,
    },
  ],
  exports: [FileService],
})
export class FileModule {}
