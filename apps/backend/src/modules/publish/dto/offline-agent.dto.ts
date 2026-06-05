import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OfflineAgentDto {
  @ApiPropertyOptional({ example: '临时下线调整配置' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
