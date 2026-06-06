import { ApiProperty } from '@nestjs/swagger';

export class ReindexResponseDto {
  @ApiProperty({ description: '被回填的知识库 ID' })
  knowledgeBaseId!: string;

  @ApiProperty({ description: '本次实际写入向量的 chunk 数量' })
  processed!: number;

  @ApiProperty({
    description: '本次跳过的 chunk 数量（force=false 且向量已存在时跳过）',
  })
  skipped!: number;

  @ApiProperty({ description: '失败的 chunk 数量（出错时通常通过抛错返回，此字段保留为 0）' })
  failed!: number;
}
