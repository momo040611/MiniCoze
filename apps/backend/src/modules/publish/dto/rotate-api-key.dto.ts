import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RotateApiKeyDto {
  @ApiPropertyOptional({ example: '定期轮换 API Key' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
