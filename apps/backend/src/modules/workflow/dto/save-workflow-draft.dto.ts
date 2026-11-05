import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsObject, IsOptional } from 'class-validator';

export class SaveWorkflowDraftDto {
  @ApiProperty({
    example: {
      nodes: [
        { id: 'start-1', type: 'start' },
        { id: 'llm-1', type: 'llm', data: { model: 'deepseek-chat' } },
        { id: 'end-1', type: 'end' },
      ],
      edges: [
        { source: 'start-1', target: 'llm-1' },
        { source: 'llm-1', target: 'end-1' },
      ],
    },
  })
  @IsObject()
  definition!: Record<string, unknown>;

  /**
   * 客户端读到的 updatedAt（版本号）。
   * 传了就做乐观锁校验：数据库里的和它不一致 → 409，说明有人在你之前改过。
   * 不传则退化为旧行为（兼容还没改的前端）。
   */
  @ApiPropertyOptional({ description: '本次编辑基于的 updatedAt，用于乐观锁' })
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}