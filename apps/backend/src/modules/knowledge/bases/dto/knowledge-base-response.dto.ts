import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KnowledgeBaseResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  creatorId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ example: 'BAAI/bge-large-zh-v1.5' })
  embeddingModel!: string;

  @ApiProperty({ example: 1024 })
  embeddingDim!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
