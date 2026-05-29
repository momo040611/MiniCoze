import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AGENT_PLUGIN_BINDING_STATUS_VALUES,
  type AgentPluginBindingStatusValue,
  type AgentPluginBindingConfig,
} from '../types/plugin.types';

class AgentPluginBindingItemDto {
  @ApiProperty({ example: 'plugin-id' })
  @IsString()
  pluginId!: string;

  @ApiPropertyOptional({ enum: AGENT_PLUGIN_BINDING_STATUS_VALUES })
  @IsOptional()
  @IsIn(AGENT_PLUGIN_BINDING_STATUS_VALUES)
  status?: AgentPluginBindingStatusValue;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoInvoke?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: AgentPluginBindingConfig;
}

export class ReplaceAgentPluginBindingsDto {
  @ApiProperty({ type: [AgentPluginBindingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentPluginBindingItemDto)
  bindings!: AgentPluginBindingItemDto[];
}
