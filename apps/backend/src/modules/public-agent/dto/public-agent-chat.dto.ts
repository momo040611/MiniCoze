import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class PublicAgentChatDto {
  @ApiPropertyOptional({ example: '你好' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  inputs?: Record<string, unknown>;
}
