import { ApiProperty } from '@nestjs/swagger';

export class DocumentChunkItemDto {
  @ApiProperty({ description: '切片唯一 id（UUID）' })
  id!: string;

  @ApiProperty({ description: '该 chunk 在文档中的顺序，从 0 开始' })
  chunkIndex!: number;

  @ApiProperty({ description: 'chunk 文本内容（不含向量）' })
  content!: string;

  @ApiProperty({ description: '按 Unicode 码点（rune）计的字符数' })
  charCount!: number;
}

export class DocumentChunksResponseDto {
  @ApiProperty()
  documentId!: string;

  @ApiProperty()
  totalChunks!: number;

  @ApiProperty({ type: [DocumentChunkItemDto] })
  list!: DocumentChunkItemDto[];
}
