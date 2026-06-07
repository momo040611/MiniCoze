import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceModule } from '../workspace/workspace.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { CosStorageService } from './storage/cos-storage.service';
import { LocalStorageService } from './storage/local-storage.service';
import { FILE_STORAGE } from './storage/storage.interface';

@Module({
  imports: [WorkspaceModule],
  controllers: [FileController],
  providers: [
    FileService,
    OptionalJwtAuthGuard,
    LocalStorageService,
    CosStorageService,
    {
      provide: FILE_STORAGE,
      useFactory: (
        configService: ConfigService,
        localStorageService: LocalStorageService,
        cosStorageService: CosStorageService,
      ) => {
        const driver =
          configService.get<string>('file.storageDriver') ?? 'local';

        if (driver === 'cos') {
          return cosStorageService;
        }

        return localStorageService;
      },
      inject: [ConfigService, LocalStorageService, CosStorageService],
    },
  ],
  exports: [FileService],
})
export class FileModule {}
