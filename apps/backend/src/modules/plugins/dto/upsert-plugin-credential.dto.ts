import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  PLUGIN_CREDENTIAL_AUTH_TYPES,
  type PluginCredentialAuthType,
} from '../plugin-credential.service';
import { PLUGIN_CREDENTIAL_STATUS_VALUES } from '../types/plugin.types';

export class UpsertPluginCredentialDto {
  @ApiProperty({ example: '主账号密钥' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: PLUGIN_CREDENTIAL_AUTH_TYPES })
  @IsIn(PLUGIN_CREDENTIAL_AUTH_TYPES as readonly string[])
  authType!: PluginCredentialAuthType;

  @ApiPropertyOptional({
    description: '明文 secret；更新时缺省表示保持原值',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  secret?: string;

  @ApiPropertyOptional({
    type: Object,
    description: '附加配置，如 API_KEY_HEADER 的 headerName、BASIC_AUTH 的 username',
    example: { headerName: 'X-API-Key' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: PLUGIN_CREDENTIAL_STATUS_VALUES })
  @IsOptional()
  @IsIn(PLUGIN_CREDENTIAL_STATUS_VALUES)
  status?: (typeof PLUGIN_CREDENTIAL_STATUS_VALUES)[number];
}
