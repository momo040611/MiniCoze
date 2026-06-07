import { ApiProperty } from '@nestjs/swagger';

export class ChunkItemDto {
  @ApiProperty({ example: 0 })
  index!: number;

  @ApiProperty({ example: 'chunk content...' })
  content!: string;

  @ApiProperty({ example: 256, description: '按 Unicode 码点（rune）计的字符数' })
  charCount!: number;
}

export class ChunkMetaDto {
  @ApiProperty({ enum: ['default', 'custom', 'leveled'] })
  chunkType!: 'default' | 'custom' | 'leveled';

  @ApiProperty({ enum: ['txt', 'md'] })
  fileExtension!: 'txt' | 'md';

  @ApiProperty({ example: 12 })
  totalChunks!: number;

  @ApiProperty({ example: 5430 })
  totalChars!: number;
}

export class ChunkDocumentResponseDto {
  @ApiProperty({ type: ChunkMetaDto })
  meta!: ChunkMetaDto;

  @ApiProperty({ type: [ChunkItemDto] })
  chunks!: ChunkItemDto[];
}
