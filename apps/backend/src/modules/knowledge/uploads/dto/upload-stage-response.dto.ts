import { ApiProperty } from '@nestjs/swagger';

export class UploadStageResponseDto {
  @ApiProperty({ description: '上传 stage 的引用 id（UUID v4）' })
  fileId!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty({ enum: ['txt', 'md'] })
  fileExtension!: string;

  @ApiProperty()
  fileSize!: number;

  @ApiProperty({ description: '过期时间（东八区字符串）' })
  expiresAt!: string;

  @ApiProperty({ description: '创建时间（东八区字符串）' })
  createdAt!: string;
}
