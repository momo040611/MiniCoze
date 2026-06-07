import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RetrieveRequestDto {
  @ApiProperty({
    description: '要检索的知识库 ID 列表（多 KB 联检），均需当前用户在所在 workspace 是成员',
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  knowledgeBaseIds!: string[];

  @ApiProperty({ description: '查询字符串（自然语言 query）', example: '退款流程是什么' })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @ApiProperty({
    description: '返回 Top-K（cosine similarity 降序）',
    minimum: 1,
    maximum: 50,
    default: 5,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topK: number = 5;

  @ApiProperty({
    description: '最低相似度阈值（cosine similarity ∈ [-1, 1]，低于该值的命中将被过滤）',
    minimum: -1,
    maximum: 1,
    default: 0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1)
  @Max(1)
  minScore: number = 0;
}
