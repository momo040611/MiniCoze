import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class PublishWorkflowDto {
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
