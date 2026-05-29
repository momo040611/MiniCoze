import { Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { chunk } from './chunking/chunk';
import type { ChunkResult } from './chunking/types';
import { ChunkConfigDto } from './dto/chunk-config.dto';
import { UploadStageService } from './uploads/upload-stage.service';

@Injectable()
export class KnowledgeService {
  constructor(private readonly uploadStageService: UploadStageService) {}

  /**
   * 切分预览：根据 fileId 从 upload stage 读文件，按 config 切分返回 chunks。
   * 不做向量化，不入库。
   */
  async chunkDocument(
    userId: string,
    fileId: string,
    configRawObject: unknown,
  ): Promise<ChunkResult> {
    const { stage, buffer } = await this.uploadStageService.loadForUser(
      userId,
      fileId,
    );
    const ext = this.extractExtension(stage.originalName);
    // ChunkConfigDto.fromJsonString 接收字符串；这里 config 已经是 object，先 stringify。
    const config = ChunkConfigDto.fromJsonString(JSON.stringify(configRawObject));
    const text = buffer.toString('utf8');
    return chunk(text, ext, config);
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
