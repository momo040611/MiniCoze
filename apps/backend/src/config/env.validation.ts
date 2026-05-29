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
