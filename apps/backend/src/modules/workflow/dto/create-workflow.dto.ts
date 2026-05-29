import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkflowDto {
  @ApiProperty({ example: 'workspace-id' })
  @IsString()
  workspaceId!: string;

  @ApiProperty({ example: '售后处理流程' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: '根据用户问题判断售后类型并生成回复' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    example: {
      version: 1,
      nodes: [],
      edges: [],
      variables: [],
    },
  })
  @IsOptional()
  @IsObject()
  graph?: Record<string, unknown>;
}
