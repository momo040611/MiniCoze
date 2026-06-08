import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAgentWorkflowBindingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
