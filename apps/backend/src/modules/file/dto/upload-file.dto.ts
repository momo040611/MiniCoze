import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FilePurpose } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  @ApiProperty({ enum: FilePurpose, example: FilePurpose.AVATAR })
  @IsEnum(FilePurpose)
  purpose!: FilePurpose;

  @ApiPropertyOptional({ example: 'workspace-id' })
  @IsOptional()
  @IsString()
  workspaceId?: string;
}
