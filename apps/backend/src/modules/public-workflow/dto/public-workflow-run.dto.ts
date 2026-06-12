import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class PublicWorkflowRunDto {
  @ApiPropertyOptional({
    example: { query: '帮我总结这段文本' },
  })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;
}
