import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

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

  @ApiPropertyOptional({
    example: 'conv_123',
    description:
      '会话 ID：用于隔离 session 变量（多轮对话记忆）。不传则本次运行无会话上下文，session 变量不可写。',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
