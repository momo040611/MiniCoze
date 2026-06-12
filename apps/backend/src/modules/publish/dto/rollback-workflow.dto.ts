import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RollbackWorkflowDto {
  @ApiProperty({ example: 'workflow-version-id' })
  @IsString()
  versionId!: string;

  @ApiPropertyOptional({ example: '线上流程异常，回滚到上一版' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
