import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class PublicAgentChatDto {
  @ApiPropertyOptional({ example: '你好' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ example: 'conversation-id' })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ example: 'visitor-id' })
  @IsOptional()
  @IsString()
  visitorId?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  inputs?: Record<string, unknown>;
}
