import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class AgentWorkflowBindingItemDto {
  @ApiProperty({ example: 'workflow-id' })
  @IsString()
  workflowId!: string;

  @ApiPropertyOptional({ example: 'workflow-version-id' })
  @IsOptional()
  @IsString()
  workflowVersionId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ReplaceAgentWorkflowBindingsDto {
  @ApiProperty({ type: [AgentWorkflowBindingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentWorkflowBindingItemDto)
  bindings!: AgentWorkflowBindingItemDto[];
}
