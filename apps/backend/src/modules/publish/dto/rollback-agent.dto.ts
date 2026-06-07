import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RollbackAgentDto {
  @ApiProperty({ example: 'agent-version-id' })
  @IsString()
  versionId!: string;

  @ApiPropertyOptional({ example: '线上效果异常，回滚到上一个稳定版本' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
