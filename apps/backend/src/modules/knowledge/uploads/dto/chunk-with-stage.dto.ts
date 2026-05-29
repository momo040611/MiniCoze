import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

/**
 * 切分预览 / 入库共用的 fileId-based 入参。
 * config 是切分配置原始对象，下游用 ChunkConfigDto.fromJsonString 复用现有校验。
 */
export class ChunkWithStageDto {
  @ApiProperty({ description: '上传 stage 返回的 fileId（UUID v4）' })
  @IsString()
  fileId!: string;

  @ApiProperty({
    description: '切分配置对象，与 POST /knowledge/uploads 之前的 config 字段一致',
    example: { chunkType: 'default' },
  })
  @IsObject()
  config!: Record<string, unknown>;
}
