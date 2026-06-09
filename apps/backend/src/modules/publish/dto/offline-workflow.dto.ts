import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OfflineWorkflowDto {
  @ApiPropertyOptional({ example: '暂停公开 API 调用，调整流程配置' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
