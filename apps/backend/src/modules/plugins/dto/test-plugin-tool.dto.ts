import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class TestPluginToolDto {
  @ApiPropertyOptional({
    description: '工具测试参数',
    example: { text: 'hello world' },
  })
  @IsOptional()
  @IsObject()
  arguments?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: '测试时临时注入的绑定配置覆盖',
    example: {
      defaults: {
        echo_text: {
          text: 'default value',
        },
      },
    },
  })
  @IsOptional()
  @IsObject()
  bindingConfig?: Record<string, unknown>;
}
