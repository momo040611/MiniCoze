import { HttpStatus, Injectable } from '@nestjs/common';
import { FilePurpose } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { chunk } from './chunking/chunk';
import type { ChunkResult } from './chunking/types';
import { ChunkConfigDto } from './dto/chunk-config.dto';
import { FileService } from '../file/file.service';

@Injectable()
export class KnowledgeService {
  constructor(private readonly fileService: FileService) {}

  /**
   * 切分预览：根据 FileAsset.id 读文件，按 config 切分返回 chunks。
   * 不做向量化，不入库。
   */
  async chunkDocument(
    userId: string,
    fileId: string,
    configRawObject: unknown,
  ): Promise<ChunkResult> {
    const { fileAsset, buffer } = await this.loadKnowledgeDocumentFile(
      userId,
      fileId,
    );
    const ext = this.extractExtension(fileAsset.originalName);
    // ChunkConfigDto.fromJsonString 接收字符串；这里 config 已经是 object，先 stringify。
    const config = ChunkConfigDto.fromJsonString(JSON.stringify(configRawObject));
    const text = buffer.toString('utf8');
    return chunk(text, ext, config);
  }

  private async loadKnowledgeDocumentFile(userId: string, fileId: string) {
    const currentUser = {
      id: userId,
      email: '',
      username: '',
    };
    const fileAsset = await this.fileService.getReadyFileForUser(
      fileId,
      currentUser,
    );

    if (fileAsset.purpose !== FilePurpose.KNOWLEDGE_DOCUMENT) {
      throw new BusinessException(
        '文件用途不是知识库文档',
        ErrorCode.KnowledgeFileTypeUnsupported,
        HttpStatus.BAD_REQUEST,
      );
    }

    const buffer = await this.fileService.getFileBufferForInternal(fileId);
    return { fileAsset, buffer };
  }

  private extractExtension(filename: string): string {
    const idx = filename.lastIndexOf('.');
    if (idx === -1 || idx === filename.length - 1) {
      throw new BusinessException(
        'file has no extension',
        ErrorCode.KnowledgeFileTypeUnsupported,
      );
    }
    return filename.slice(idx + 1).toLowerCase();
  }
}
