import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

enum FileStorageDriver {
  Local = 'local',
  Cos = 'cos',
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

  @IsString()
  @IsOptional()
  @IsEnum(FileStorageDriver)
  FILE_STORAGE_DRIVER: FileStorageDriver = FileStorageDriver.Local;

  @IsString()
  @IsOptional()
  FILE_UPLOAD_DIR = 'storage/uploads';

  @IsString()
  @IsOptional()
  FILE_PUBLIC_BASE_URL = '/api/files';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  FILE_MAX_IMAGE_SIZE = 5242880;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  FILE_MAX_DOCUMENT_SIZE = 52428800;

  @ValidateIf(
    (env: EnvironmentVariables) =>
      env.FILE_STORAGE_DRIVER === FileStorageDriver.Cos,
  )
  @IsString()
  @IsNotEmpty()
  COS_SECRET_ID?: string;

  @ValidateIf(
    (env: EnvironmentVariables) =>
      env.FILE_STORAGE_DRIVER === FileStorageDriver.Cos,
  )
  @IsString()
  @IsNotEmpty()
  COS_SECRET_KEY?: string;

  @ValidateIf(
    (env: EnvironmentVariables) =>
      env.FILE_STORAGE_DRIVER === FileStorageDriver.Cos,
  )
  @IsString()
  @IsNotEmpty()
  COS_BUCKET?: string;

  @ValidateIf(
    (env: EnvironmentVariables) =>
      env.FILE_STORAGE_DRIVER === FileStorageDriver.Cos,
  )
  @IsString()
  @IsNotEmpty()
  COS_REGION?: string;

  @IsString()
  @IsOptional()
  COS_PUBLIC_BASE_URL?: string;

  @IsString()
  @IsOptional()
  BING_SEARCH_API_KEY?: string;

  @IsString()
  @IsOptional()
  BING_SEARCH_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  BING_SEARCH_TIMEOUT_MS = 10000;

  @IsString()
  @IsOptional()
  IMAGE_UNDERSTANDING_API_KEY?: string;

  @IsString()
  @IsOptional()
  IMAGE_UNDERSTANDING_BASE_URL = 'https://api.openai.com/v1';

  @IsString()
  @IsOptional()
  IMAGE_UNDERSTANDING_MODEL = 'gpt-4o-mini';

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  IMAGE_UNDERSTANDING_TIMEOUT_MS = 20000;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  LINK_READER_TIMEOUT_MS = 15000;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  LINK_READER_MAX_CHARS = 20000;
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
