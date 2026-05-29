import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  PLUGIN_TOOL_STATUS_VALUES,
  type PluginToolStatusValue,
} from '../types/plugin.types';
import { CreatePluginToolDto } from './create-plugin-tool.dto';

export class UpdatePluginToolDto extends PartialType(CreatePluginToolDto) {
  @ApiPropertyOptional({ enum: PLUGIN_TOOL_STATUS_VALUES })
  @IsOptional()
  @IsIn(PLUGIN_TOOL_STATUS_VALUES)
  status?: PluginToolStatusValue;
}
