import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { WorkspaceCredentialStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateCredentialDto } from './create-credential.dto';

// 更新时所有字段可选；不传 secret 表示保留原密钥。
export class UpdateCredentialDto extends PartialType(CreateCredentialDto) {
  @ApiPropertyOptional({ enum: WorkspaceCredentialStatus })
  @IsOptional()
  @IsEnum(WorkspaceCredentialStatus)
  status?: WorkspaceCredentialStatus;
}
