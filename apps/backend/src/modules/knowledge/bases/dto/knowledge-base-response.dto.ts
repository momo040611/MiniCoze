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

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
