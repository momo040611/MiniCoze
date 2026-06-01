import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  PLUGIN_TYPE_VALUES,
  type PluginTypeValue,
} from '../types/plugin.types';

export class CreatePluginDto {
  @ApiProperty({ example: 'workspace-id' })
  @IsString()
  workspaceId!: string;

  @ApiProperty({ example: 'weather' })
  @IsString()
  @MaxLength(64)
  code!: string;

  @ApiProperty({ example: '天气插件' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: '查询天气信息的内置插件' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/plugin.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string;

  @ApiPropertyOptional({ enum: PLUGIN_TYPE_VALUES, default: 'BUILTIN' })
  @IsOptional()
  @IsIn(PLUGIN_TYPE_VALUES)
  type?: PluginTypeValue;

  @ApiPropertyOptional({ example: 'v1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  version?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isBuiltin?: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  maskStrategy?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  invocationEnabled?: boolean;
}
