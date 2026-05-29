import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  PLUGIN_STATUS_VALUES,
  PLUGIN_TYPE_VALUES,
  type PluginStatusValue,
  type PluginTypeValue,
} from '../types/plugin.types';

export class PluginQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'workspace-id' })
  @IsString()
  workspaceId!: string;

  @ApiPropertyOptional({ enum: PLUGIN_TYPE_VALUES })
  @IsOptional()
  @IsIn(PLUGIN_TYPE_VALUES)
  type?: PluginTypeValue;

  @ApiPropertyOptional({ enum: PLUGIN_STATUS_VALUES })
  @IsOptional()
  @IsIn(PLUGIN_STATUS_VALUES)
  status?: PluginStatusValue;

  @ApiPropertyOptional({ example: 'weather' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;
}
