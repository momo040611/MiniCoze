import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishWorkflowDto {
  @ApiPropertyOptional({ example: '首次发布' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
