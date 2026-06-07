import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleChunkDto {
  @ApiProperty({ description: '是否启用该切片' })
  @IsBoolean()
  enabled!: boolean;
}
