import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';

const CIPHER_ALGORITHM = 'aes-256-gcm';
const SECRET_VERSION = 'v1';
const DEV_FALLBACK_SECRET = 'minicoze-dev-stable-secret-encryption-key';

@Injectable()
export class SecretService {
  private readonly logger = new Logger(SecretService.name);
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.key = this.resolveKey();
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(CIPHER_ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // 存储格式带版本号，后续如果更换算法或 KMS，可以兼容旧密文。
    return [
      SECRET_VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const [version, ivText, tagText, encryptedText] = payload.split(':');

    if (version !== SECRET_VERSION || !ivText || !tagText || !encryptedText) {
      throw new BusinessException(
        '凭证密文格式无效',
        ErrorCode.BusinessError,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const decipher = createDecipheriv(
        CIPHER_ALGORITHM,
        this.key,
        Buffer.from(ivText, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tagText, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64')),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      throw new BusinessException(
        '凭证解密失败',
        ErrorCode.BusinessError,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  maskSecret(secret: string): string {
    const value = secret.trim();
    if (value.length <= 8) {
      return '****';
    }

    return `${value.slice(0, 4)}****${value.slice(-4)}`;
  }

  private resolveKey(): Buffer {
    const rawKey = this.configService.get<string>('SECRET_ENCRYPTION_KEY');
    const nodeEnv =
      this.configService.get<string>('app.nodeEnv') ??
      process.env.NODE_ENV ??
      'development';

    if (!rawKey) {
      if (nodeEnv === 'production') {
        throw new BusinessException(
          'SECRET_ENCRYPTION_KEY is required in production',
          ErrorCode.AiConfigError,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.warn(
        'SECRET_ENCRYPTION_KEY 未配置，开发环境将使用稳定 fallback。生产环境必须配置该变量。',
      );
    }

    // AES-256-GCM 需要 32 字节 key。这里对原始环境变量做 SHA-256 派生，
    // 允许部署侧使用普通随机字符串，避免强制要求 base64/hex 格式。
    return createHash('sha256')
      .update(rawKey ?? DEV_FALLBACK_SECRET)
      .digest();
  }
}
