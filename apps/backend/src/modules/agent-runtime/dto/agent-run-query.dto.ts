import { ApiPropertyOptional } from '@nestjs/swagger';
import { AgentRunSource, AgentRunStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AgentRunQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '按 Agent 过滤' })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ description: '按工作区过滤' })
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiPropertyOptional({ enum: AgentRunStatus })
  @IsOptional()
  @IsIn(Object.values(AgentRunStatus))
  status?: AgentRunStatus;

  @ApiPropertyOptional({ enum: AgentRunSource })
  @IsOptional()
  @IsIn(Object.values(AgentRunSource))
  source?: AgentRunSource;
}
