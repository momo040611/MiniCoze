import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class WorkflowQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'workspace-id' })
  @IsString()
  workspaceId!: string;

  @ApiPropertyOptional({ enum: WorkflowStatus })
  @IsOptional()
  @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;

  @ApiPropertyOptional({ example: '客服' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}
