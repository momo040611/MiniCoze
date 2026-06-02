import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class TogglePluginDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}
