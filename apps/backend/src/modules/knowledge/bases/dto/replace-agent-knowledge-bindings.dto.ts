import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { RuntimeKnowledgeBindingConfig } from '../../../../shared/types/agent';

class AgentKnowledgeBindingConfigDto implements RuntimeKnowledgeBindingConfig {
  @ApiPropertyOptional({ default: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  topK?: number;

  @ApiPropertyOptional({ default: 0.3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;
}

class AgentKnowledgeBindingItemDto {
  @ApiProperty({ example: 'kb-id' })
  @IsString()
  knowledgeBaseId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: AgentKnowledgeBindingConfigDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AgentKnowledgeBindingConfigDto)
  config?: RuntimeKnowledgeBindingConfig;
}

export class ReplaceAgentKnowledgeBindingsDto {
  @ApiProperty({ type: [AgentKnowledgeBindingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentKnowledgeBindingItemDto)
  bindings!: AgentKnowledgeBindingItemDto[];
}
