import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @ApiProperty({ example: 'cm0xxxx', description: '所属工作空间 ID' })
  @IsString()
  workspaceId!: string;

  @ApiProperty({ example: '产品手册', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: '客服常用文档汇总', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
