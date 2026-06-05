import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

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
}
