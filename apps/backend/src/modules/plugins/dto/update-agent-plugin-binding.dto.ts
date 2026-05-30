import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional } from 'class-validator';
import {
  AGENT_PLUGIN_BINDING_STATUS_VALUES,
  type AgentPluginBindingConfig,
  type AgentPluginBindingStatusValue,
} from '../types/plugin.types';

export class UpdateAgentPluginBindingDto {
  @ApiPropertyOptional({ enum: AGENT_PLUGIN_BINDING_STATUS_VALUES })
  @IsOptional()
  @IsIn(AGENT_PLUGIN_BINDING_STATUS_VALUES)
  status?: AgentPluginBindingStatusValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoInvoke?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: AgentPluginBindingConfig;
}
