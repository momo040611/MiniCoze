import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PluginCredential,
  PluginCredentialStatus,
  Prisma,
} from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { SecretService } from '../credentials/secret.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';

export const PLUGIN_CREDENTIAL_AUTH_TYPES = [
  'BEARER_TOKEN',
  'API_KEY_HEADER',
  'BASIC_AUTH',
] as const;

export type PluginCredentialAuthType =
  (typeof PLUGIN_CREDENTIAL_AUTH_TYPES)[number];

export interface RuntimePluginCredential {
  authType: PluginCredentialAuthType;
  secret: string;
  config: Record<string, unknown>;
}

export interface PluginCredentialResponse {
  id: string;
  pluginId: string;
  name: string;
  authType: string;
  status: string;
  maskedHint: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface UpsertCredentialInput {
  name: string;
  authType: PluginCredentialAuthType;
  /** 明文 secret 仅在创建/更新时出现，响应永不回传。 */
  secret?: string;
  config?: Record<string, unknown>;
  status?: PluginCredentialStatus;
}

/**
 * 插件级凭据管理：
 * - secret 用 SecretService（AES-256-GCM）加密落库，响应只回掩码
 * - HTTP 插件执行时按 pluginId 取 ACTIVE 凭据解密注入认证头
 */
@Injectable()
export class PluginCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretService: SecretService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async list(userId: string, pluginId: string): Promise<PluginCredentialResponse[]> {
    await this.ensurePluginManageAccess(userId, pluginId);
    const rows = await this.prisma.pluginCredential.findMany({
      where: { pluginId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toResponse(row));
  }

  async create(
    userId: string,
    pluginId: string,
    input: UpsertCredentialInput,
  ): Promise<PluginCredentialResponse> {
    await this.ensurePluginManageAccess(userId, pluginId);
    const plugin = await this.getPlugin(pluginId);

    const created = await this.prisma.pluginCredential.create({
      data: {
        pluginId,
        workspaceId: plugin.workspaceId,
        name: input.name,
        authType: input.authType,
        secretEncrypted: this.encryptSecret(input),
        config: (input.config ?? {}) as Prisma.InputJsonValue,
        status: input.status ?? PluginCredentialStatus.ACTIVE,
      },
    });

    return this.toResponse(created);
  }

  async update(
    userId: string,
    pluginId: string,
    credentialId: string,
    input: UpsertCredentialInput,
  ): Promise<PluginCredentialResponse> {
    await this.ensurePluginManageAccess(userId, pluginId);
    const existing = await this.getExisting(pluginId, credentialId);

    const updated = await this.prisma.pluginCredential.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        authType: input.authType,
        // 未传 secret 表示保持原密文不变。
        secretEncrypted: input.secret
          ? this.encryptSecret(input)
          : undefined,
        config:
          input.config === undefined
            ? undefined
            : (input.config as Prisma.InputJsonValue),
        status: input.status,
      },
    });

    return this.toResponse(updated);
  }

  async remove(userId: string, pluginId: string, credentialId: string): Promise<void> {
    await this.ensurePluginManageAccess(userId, pluginId);
    const existing = await this.getExisting(pluginId, credentialId);
    await this.prisma.pluginCredential.delete({ where: { id: existing.id } });
  }

  /**
   * 运行时取凭据（HTTP 执行器调用）：解密明文 secret。
   * 取第一个 ACTIVE 凭据；一个插件多凭据时按 createdAt 最新的生效。
   */
  async getRuntimeCredential(pluginId: string): Promise<RuntimePluginCredential | null> {
    const row = await this.prisma.pluginCredential.findFirst({
      where: { pluginId, status: PluginCredentialStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });

    if (!row) {
      return null;
    }

    if (row.authType === 'BASIC_AUTH') {
      // Basic Auth 的 config 里存 username，secret 存 password。
      const username = this.readConfigString(row.config, 'username');
      const password = row.secretEncrypted
        ? this.secretService.decrypt(row.secretEncrypted)
        : '';
      return {
        authType: 'BASIC_AUTH',
        secret: Buffer.from(`${username}:${password}`).toString('base64'),
        config: this.toConfigRecord(row.config),
      };
    }

    return {
      authType: this.normalizeAuthType(row.authType),
      secret: row.secretEncrypted
        ? this.secretService.decrypt(row.secretEncrypted)
        : '',
      config: this.toConfigRecord(row.config),
    };
  }

  private encryptSecret(input: UpsertCredentialInput): string {
    if (!input.secret?.trim()) {
      throw new BusinessException(
        'secret 不能为空',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.secretService.encrypt(input.secret.trim());
  }

  private async ensurePluginManageAccess(
    userId: string,
    pluginId: string,
  ): Promise<void> {
    const plugin = await this.getPlugin(pluginId);
    await this.workspaceAccessService.ensureCanManage(userId, plugin.workspaceId);
  }

  private async getPlugin(pluginId: string) {
    const plugin = await this.prisma.pluginDefinition.findUnique({
      where: { id: pluginId },
      select: { id: true, workspaceId: true },
    });

    if (!plugin) {
      throw new BusinessException(
        '插件不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return plugin;
  }

  private async getExisting(
    pluginId: string,
    credentialId: string,
  ): Promise<PluginCredential> {
    const existing = await this.prisma.pluginCredential.findFirst({
      where: { id: credentialId, pluginId },
    });

    if (!existing) {
      throw new BusinessException(
        '插件凭据不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return existing;
  }

  private normalizeAuthType(value: string): PluginCredentialAuthType {
    return (PLUGIN_CREDENTIAL_AUTH_TYPES as readonly string[]).includes(value)
      ? (value as PluginCredentialAuthType)
      : 'BEARER_TOKEN';
  }

  private toConfigRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private readConfigString(
    value: Prisma.JsonValue | null,
    key: string,
  ): string {
    const record = this.toConfigRecord(value);
    return typeof record[key] === 'string' ? (record[key] as string) : '';
  }

  private toResponse(row: PluginCredential): PluginCredentialResponse {
    // 响应不携带任何明文/密文信息；掩码仅作占位提示。
    const maskedHint =
      row.authType === 'BASIC_AUTH' ? 'user:****' : '****';

    return {
      id: row.id,
      pluginId: row.pluginId,
      name: row.name,
      authType: row.authType,
      status: row.status,
      maskedHint,
      config: this.toConfigRecord(row.config),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
