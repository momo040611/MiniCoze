import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PublicAgentAttachmentDto {
  @IsString()
  fileId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  size?: number;
}

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

  @ApiPropertyOptional({ type: [PublicAgentAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicAgentAttachmentDto)
  attachments?: PublicAgentAttachmentDto[];
}
