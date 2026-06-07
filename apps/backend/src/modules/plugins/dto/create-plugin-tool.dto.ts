import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePluginToolDto {
  @ApiProperty({ example: 'get_current_weather' })
  @IsString()
  @MaxLength(64)
  code!: string;

  @ApiProperty({ example: '查询当前天气' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: '根据城市查询当前天气信息' })
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  inputSchema!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
