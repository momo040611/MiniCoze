import { ApiProperty } from '@nestjs/swagger';

export class UploadedDocumentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  knowledgeBaseId!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty({ enum: ['txt', 'md'] })
  fileExtension!: string;

  @ApiProperty()
  fileSize!: number;

  @ApiProperty({ enum: ['default', 'custom', 'leveled'] })
  chunkType!: string;

  @ApiProperty({
    description: '上传时使用的切分配置原始 JSON，回显用于"按原配置重切"',
    example: { chunkType: 'default' },
  })
  chunkConfig!: Record<string, unknown>;

  @ApiProperty()
  totalChunks!: number;

  @ApiProperty()
  totalChars!: number;

  @ApiProperty()
  createdAt!: string;
}

export class ChunkSummaryDto {
  @ApiProperty()
  totalChunks!: number;

  @ApiProperty()
  totalChars!: number;
}

export class UploadDocumentResponseDto {
  @ApiProperty({ type: UploadedDocumentDto })
  document!: UploadedDocumentDto;

  @ApiProperty({ type: ChunkSummaryDto })
  chunkSummary!: ChunkSummaryDto;
}
