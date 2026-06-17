import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({ example: 'workspace-id' })
  @IsString()
  workspaceId!: string;

  @ApiProperty({ example: '客服助手' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: '用于回答产品和售后问题' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @ApiProperty({ example: '你是一个专业、耐心的客服助手。' })
  @IsString()
  @MaxLength(10000)
  systemPrompt!: string;

  @ApiPropertyOptional({ example: 'deepseek-v4-flash' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ example: 'workspace-model-id' })
  @IsOptional()
  @IsString()
  workspaceModelId?: string;

  @ApiPropertyOptional({ example: 0.7, minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ example: '你好，我可以帮你解答产品和售后问题。' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  openingMessage?: string;

  @ApiPropertyOptional({ example: 20, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  contextLimit?: number;
}
