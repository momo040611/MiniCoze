import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN = '2h';

  @IsString()
  @IsOptional()
  REDIS_HOST = 'localhost';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  REDIS_PORT = 6379;

  @IsString()
  @IsOptional()
  CORS_ORIGIN =
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173';

  // === Knowledge / Embedding ===
  // OpenAI 兼容 embedding 接口；硅基流动 / 阿里 DashScope 等。
  @IsString()
  @IsNotEmpty()
  EMBEDDING_BASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  EMBEDDING_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  EMBEDDING_MODEL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  EMBEDDING_DIM!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  EMBEDDING_BATCH_SIZE = 32;

  // === Knowledge / Upload Stage ===
  // 上传 stage 文件的本地磁盘目录，相对 backend 工作目录或绝对路径。
  @IsString()
  @IsOptional()
  UPLOAD_STORAGE_DIR = './storage/uploads';
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  if (
    validatedConfig.NODE_ENV === NodeEnv.Production &&
    (validatedConfig.JWT_SECRET === 'replace-me' ||
      validatedConfig.JWT_SECRET.length < 32)
  ) {
    throw new Error('JWT_SECRET is too weak for production');
  }

  return validatedConfig;
}
