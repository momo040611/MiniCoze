import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowRunStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class WorkflowRunQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WorkflowRunStatus })
  @IsOptional()
  @IsEnum(WorkflowRunStatus)
  status?: WorkflowRunStatus;
}
