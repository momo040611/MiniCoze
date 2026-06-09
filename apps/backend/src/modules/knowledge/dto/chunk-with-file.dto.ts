import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

/**
 * 切分预览 / 入库共用的 FileAsset.id-based 入参。
 * config 是切分配置原始对象，下游用 ChunkConfigDto.fromJsonString 复用现有校验。
 */
export class ChunkWithFileDto {
  @ApiProperty({ description: '通用文件上传接口返回的 FileAsset.id' })
  @IsString()
  fileId!: string;

  @ApiProperty({
    description: '切分配置对象',
    example: { chunkType: 'default' },
  })
  @IsObject()
  config!: Record<string, unknown>;
}
