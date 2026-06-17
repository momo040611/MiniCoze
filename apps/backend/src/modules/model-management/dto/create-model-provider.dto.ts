import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModelProviderType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// 创建模型服务 Provider。Provider 描述服务入口，认证信息通过 credentialId 关联凭证表。
export class CreateModelProviderDto {
  @ApiProperty({ example: 'DeepSeek 内网服务' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: ModelProviderType })
  @IsEnum(ModelProviderType)
  providerType!: ModelProviderType;

  @ApiProperty({ example: 'http://127.0.0.1:8000/v1' })
  @IsString()
  @MaxLength(500)
  baseUrl!: string;

  @ApiProperty({ example: 'credential-id' })
  @IsString()
  credentialId!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
