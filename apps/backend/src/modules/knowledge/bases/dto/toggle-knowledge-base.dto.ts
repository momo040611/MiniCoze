import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleKnowledgeBaseDto {
  @ApiProperty({ description: '是否启用该知识库' })
  @IsBoolean()
  enabled!: boolean;
}
