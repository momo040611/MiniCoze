import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceCredentialType } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// 创建通用工作区凭证。凭证可被模型 Provider 引用，后续也可复用于其他后端集成。
export class CreateCredentialDto {
  @ApiProperty({ example: 'OpenAI API Key' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: WorkspaceCredentialType })
  @IsEnum(WorkspaceCredentialType)
  type!: WorkspaceCredentialType;

  @ApiProperty({ example: 'sk-...' })
  @IsString()
  @MaxLength(4096)
  secret!: string;

  @ApiPropertyOptional({
    example: { headerName: 'Authorization', username: 'user' },
  })
  // config 用于补充不同认证方式的非敏感参数，例如自定义 headerName 或 Basic 用户名。
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
