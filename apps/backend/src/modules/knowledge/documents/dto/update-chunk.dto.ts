import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateChunkDto {
  @ApiProperty({ description: '新的切片文本内容' })
  @IsString()
  @MinLength(1)
  content!: string;
}
