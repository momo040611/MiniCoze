import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class TestToolDto {
  @ApiProperty({ type: Object })
  @IsObject()
  params: Record<string, unknown>;
}
