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

  @ApiProperty({
    enum: ['UPLOADED', 'PROCESSING', 'PARSED', 'CHUNKED', 'EMBEDDING', 'READY', 'FAILED'],
    description: '文档处理状态（READY 才可被检索）',
  })
  status!: string;

  @ApiProperty({ nullable: true, description: '处理失败原因，仅 FAILED 时有值' })
  errorMessage!: string | null;

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

  // 上传已异步化：请求立即返回时流水线尚未跑完，chunkSummary 恒为 null
  // （完成后的真实切分统计在文档列表接口中可查）。
  @ApiProperty({ type: ChunkSummaryDto, nullable: true })
  chunkSummary!: ChunkSummaryDto | null;
}
