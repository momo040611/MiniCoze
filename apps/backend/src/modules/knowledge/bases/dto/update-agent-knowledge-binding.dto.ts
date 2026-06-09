import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { RuntimeKnowledgeBindingConfig } from '../../../../shared/types/agent';

class AgentKnowledgeBindingConfigDto implements RuntimeKnowledgeBindingConfig {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  topK?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;
}

export class UpdateAgentKnowledgeBindingDto {
  @ApiPropertyOptional()
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
