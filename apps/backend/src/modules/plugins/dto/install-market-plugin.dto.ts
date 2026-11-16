import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class InstallMarketPluginDto {
  @ApiProperty({ description: '目标工作空间 ID' })
  @IsNotEmpty()
  @IsString()
  workspaceId!: string;

  @ApiProperty({ description: '插件市场目录编码，例如 bing_web_search' })
  @IsNotEmpty()
  @IsString()
  code!: string;
}
