import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishWorkflowDto {
  @ApiPropertyOptional({ example: '发布客服自动回复流程 v2' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changelog?: string;

  @ApiPropertyOptional({
    example: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  })
  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: {
      type: 'object',
      properties: { answer: { type: 'string' } },
      required: ['answer'],
    },
  })
  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;
}
