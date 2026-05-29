import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SaveWorkflowGraphDto {
  @ApiProperty({
    example: {
      version: 1,
      nodes: [],
      edges: [],
      variables: [],
    },
  })
  @IsObject()
  graph!: Record<string, unknown>;
}
