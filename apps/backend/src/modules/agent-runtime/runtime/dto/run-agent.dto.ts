import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ToolDefinition } from '../../../../shared/types/agent';

export class RunAgentAttachmentDto {
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

export class RunAgentDto {
  @IsString()
  agentId!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  @IsArray()
  tools?: ToolDefinition[];

  @IsOptional()
  @IsBoolean()
  preview?: boolean;

  @IsOptional()
  @IsString()
  knowledgeBaseId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RunAgentAttachmentDto)
  attachments?: RunAgentAttachmentDto[];
}
