import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class RunWorkflowDto {
  @ApiPropertyOptional({
    example: { query: '帮我总结这段文档' },
    description:
      '运行输入参数，具体结构由 workflow version 的 inputSchema 决定',
  })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 3,
    description: '指定执行某个版本；不传则默认执行当前发布版本',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}
