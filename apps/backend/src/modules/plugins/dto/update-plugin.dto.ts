import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  PLUGIN_STATUS_VALUES,
  type PluginStatusValue,
} from '../types/plugin.types';
import { CreatePluginDto } from './create-plugin.dto';

export class UpdatePluginDto extends PartialType(CreatePluginDto) {
  @ApiPropertyOptional({ enum: PLUGIN_STATUS_VALUES })
  @IsOptional()
  @IsIn(PLUGIN_STATUS_VALUES)
  status?: PluginStatusValue;
}
