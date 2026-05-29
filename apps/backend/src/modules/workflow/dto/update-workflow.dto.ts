import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWorkflowDto {
  @ApiPropertyOptional({ example: '售后处理流程' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: '根据用户问题判断售后类型并生成回复' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ enum: WorkflowStatus })
  @IsOptional()
  @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;
}
