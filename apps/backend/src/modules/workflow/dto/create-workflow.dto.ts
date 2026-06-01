import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkflowDto {
  @ApiProperty({ example: 'workspace-id' })
  @IsString()
  workspaceId!: string;

  @ApiProperty({ example: '客服分流工作流' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: '用于售前售后问题自动分流' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: {
      nodes: [
        { id: 'start-1', type: 'start' },
        { id: 'end-1', type: 'end' },
      ],
      edges: [{ source: 'start-1', target: 'end-1' }],
    },
  })
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;
}
