import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// 创建具体模型。一个 Provider 下通过 modelId 唯一识别真实底层模型。
export class CreateWorkspaceModelDto {
  @ApiProperty({ example: 'provider-id' })
  @IsString()
  providerId!: string;

  @ApiProperty({ example: 'deepseek-chat' })
  @IsString()
  @MaxLength(120)
  modelId!: string;

  @ApiProperty({ example: 'DeepSeek Chat' })
  @IsString()
  @MaxLength(120)
  displayName!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: { chat: true, image: false } })
  // capabilities 用于记录模型能力，例如 chat、tool_call、image 等，运行时可据此做能力校验。
  @IsOptional()
  @IsObject()
  capabilities?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 128000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  contextWindow?: number;

  @ApiPropertyOptional({ example: 4096 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOutputTokens?: number;
}
