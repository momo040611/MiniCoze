import { ApiPropertyOptional } from '@nestjs/swagger';
import { FilePurpose, FileStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FileQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'workspace-id' })
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiPropertyOptional({ enum: FilePurpose })
  @IsOptional()
  @IsEnum(FilePurpose)
  purpose?: FilePurpose;

  @ApiPropertyOptional({ enum: FileStatus, default: FileStatus.READY })
  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus;

  @ApiPropertyOptional({ example: 'document.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}
