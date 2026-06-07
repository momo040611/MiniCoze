import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import type { ChunkConfig } from '../chunking/types';

const CHUNK_TYPES = ['default', 'custom', 'leveled'] as const;
type ChunkTypeLiteral = (typeof CHUNK_TYPES)[number];

/**
 * 切分配置 DTO。
 * 客户端通过 multipart 字段 `config` 传入 JSON 字符串，由 fromJsonString 完成 parse + 校验。
 */
export class ChunkConfigDto {
  @ApiProperty({ enum: CHUNK_TYPES, example: 'default' })
  @IsEnum(CHUNK_TYPES)
  chunkType!: ChunkTypeLiteral;

  // ===== custom =====
  @ApiPropertyOptional({ minimum: 1, example: 800 })
  @ValidateIf((o: ChunkConfigDto) => o.chunkType === 'custom')
  @IsInt()
  @Min(1)
  chunkSize?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 99, example: 10 })
  @ValidateIf((o: ChunkConfigDto) => o.chunkType === 'custom')
  @IsInt()
  @Min(0)
  @Max(99)
  overlap?: number;

  @ApiPropertyOptional({ example: '\n\n' })
  @IsOptional()
  @IsString()
  separator?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  trimSpace?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  trimUrlAndEmail?: boolean;

  // ===== leveled =====
  @ApiPropertyOptional({ minimum: 1, maximum: 6, example: 3 })
  @ValidateIf((o: ChunkConfigDto) => o.chunkType === 'leveled')
  @IsInt()
  @Min(1)
  @Max(6)
  maxDepth?: number;

  @ApiPropertyOptional({ example: true })
  @ValidateIf((o: ChunkConfigDto) => o.chunkType === 'leveled')
  @IsBoolean()
  saveTitle?: boolean;

  /**
   * 把 multipart 中传入的 JSON 字符串转成可直接给 chunk() 调度入口使用的 ChunkConfig。
   * 任何 parse / 校验失败均抛 BusinessException(KnowledgeChunkConfigInvalid)。
   */
  static fromJsonString(raw: unknown): ChunkConfig {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new BusinessException(
        'config must be a non-empty JSON string',
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BusinessException(
        'config is not valid JSON',
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BusinessException(
        'config must be a JSON object',
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }

    const dto = plainToInstance(ChunkConfigDto, parsed, {
      enableImplicitConversion: false,
    });
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    if (errors.length > 0) {
      const msg = errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .filter(Boolean)
        .join('; ');
      throw new BusinessException(
        msg || 'invalid chunk config',
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }

    return ChunkConfigDto.toChunkConfig(dto);
  }

  private static toChunkConfig(dto: ChunkConfigDto): ChunkConfig {
    switch (dto.chunkType) {
      case 'default':
        return { chunkType: 'default' };
      case 'custom':
        return {
          chunkType: 'custom',
          chunkSize: dto.chunkSize as number,
          overlap: dto.overlap as number,
          separator: dto.separator ?? '\n\n',
          trimSpace: dto.trimSpace ?? true,
          trimUrlAndEmail: dto.trimUrlAndEmail ?? false,
        };
      case 'leveled':
        return {
          chunkType: 'leveled',
          maxDepth: dto.maxDepth as number,
          saveTitle: dto.saveTitle as boolean,
        };
    }
  }
}
