import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishAgentDto {
  @ApiPropertyOptional({ example: '调整提示词，绑定售后查询工作流' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changelog?: string;
}
