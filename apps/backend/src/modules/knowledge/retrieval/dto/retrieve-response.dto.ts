import { ApiProperty } from '@nestjs/swagger';

export class RetrievedChunkDto {
  @ApiProperty({ description: 'chunk ID（KnowledgeChunk.id）' })
  chunkId!: string;

  @ApiProperty({ description: '所属知识库 ID' })
  knowledgeBaseId!: string;

  @ApiProperty({ description: '所属文档 ID' })
  documentId!: string;

  @ApiProperty({ description: '所属文档名（用于前端展示）' })
  documentName!: string;

  @ApiProperty({ description: 'chunk 在文档内的序号（0 起）' })
  index!: number;

  @ApiProperty({ description: 'chunk 文本内容' })
  content!: string;

  @ApiProperty({
    description: 'cosine similarity = 1 - cosine_distance，越大越相关',
  })
  score!: number;
}

export class RetrieveResponseDto {
  @ApiProperty({ type: [RetrievedChunkDto] })
  results!: RetrievedChunkDto[];
}
