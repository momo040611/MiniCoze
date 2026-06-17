import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  WorkspaceCredential,
  WorkspaceCredentialStatus,
} from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';
import { SecretService } from './secret.service';
import {
  CredentialReferenceResponse,
  CredentialResponse,
  RuntimeCredential,
} from './types/credential-response.type';

@Injectable()
export class CredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly secretService: SecretService,
  ) {}

  async list(
    userId: string,
    workspaceId: string,
  ): Promise<CredentialResponse[]> {
    // 成员可以查看凭证元信息，但不能看到密文或明文。
    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const credentials = await this.prisma.workspaceCredential.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });

    return credentials.map((credential) => this.toResponse(credential));
  }

  async create(
    userId: string,
    workspaceId: string,
    dto: CreateCredentialDto,
  ): Promise<CredentialResponse> {
    // 凭证属于安全配置，只有 OWNER/ADMIN 可以创建。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);

    const credential = await this.prisma.workspaceCredential.create({
      data: {
        workspaceId,
        name: dto.name,
        type: dto.type,
        secretEncrypted: this.secretService.encrypt(dto.secret),
        maskedHint: this.secretService.maskSecret(dto.secret),
        config: this.toJsonInput(dto.config),
        createdBy: userId,
      },
    });

    return this.toResponse(credential);
  }

  async update(
    userId: string,
    workspaceId: string,
    credentialId: string,
    dto: UpdateCredentialDto,
  ): Promise<CredentialResponse> {
    // 更新时允许只改名称、状态或 config；未传 secret 时保留旧密钥。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    await this.findWorkspaceCredentialOrThrow(workspaceId, credentialId);

    const data: Prisma.WorkspaceCredentialUpdateInput = {
      name: dto.name,
      type: dto.type,
      status: dto.status,
      config:
        dto.config === undefined ? undefined : this.toJsonInput(dto.config),
    };

    if (dto.secret !== undefined) {
      data.secretEncrypted = this.secretService.encrypt(dto.secret);
      data.maskedHint = this.secretService.maskSecret(dto.secret);
    }

    const credential = await this.prisma.workspaceCredential.update({
      where: { id: credentialId },
      data,
    });

    return this.toResponse(credential);
  }

  async remove(
    userId: string,
    workspaceId: string,
    credentialId: string,
  ): Promise<CredentialResponse> {
    // 凭证被 Provider 引用时不能删除，避免运行时模型服务丢失认证信息。
    await this.workspaceAccessService.ensureCanManage(userId, workspaceId);
    const credential = await this.findWorkspaceCredentialOrThrow(
      workspaceId,
      credentialId,
    );

    const providerCount = await this.prisma.workspaceModelProvider.count({
      where: { credentialId, workspaceId },
    });

    if (providerCount > 0) {
      throw new BusinessException(
        '凭证仍被模型服务引用，不能删除',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.workspaceCredential.delete({
      where: { id: credentialId },
    });

    return this.toResponse(credential);
  }

  async getReferences(
    userId: string,
    workspaceId: string,
    credentialId: string,
  ): Promise<CredentialReferenceResponse> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);
    await this.findWorkspaceCredentialOrThrow(workspaceId, credentialId);

    const modelProviders = await this.prisma.workspaceModelProvider.findMany({
      where: { workspaceId, credentialId },
      select: {
        id: true,
        name: true,
        providerType: true,
        enabled: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return { modelProviders };
  }

  async getRuntimeCredential(
    workspaceId: string,
    credentialId: string,
  ): Promise<RuntimeCredential> {
    // 运行时是唯一需要解密的位置；Controller 查询路径不会返回 secret。
    const credential = await this.findWorkspaceCredentialOrThrow(
      workspaceId,
      credentialId,
    );

    if (credential.status !== WorkspaceCredentialStatus.ACTIVE) {
      throw new BusinessException(
        '模型服务凭证已停用',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.workspaceCredential.update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: credential.id,
      type: credential.type,
      secret: this.secretService.decrypt(credential.secretEncrypted),
      config: this.toRecord(credential.config),
    };
  }

  async ensureBelongsToWorkspace(
    workspaceId: string,
    credentialId: string,
  ): Promise<WorkspaceCredential> {
    return this.findWorkspaceCredentialOrThrow(workspaceId, credentialId);
  }

  private async findWorkspaceCredentialOrThrow(
    workspaceId: string,
    credentialId: string,
  ): Promise<WorkspaceCredential> {
    const credential = await this.prisma.workspaceCredential.findFirst({
      where: { id: credentialId, workspaceId },
    });

    if (!credential) {
      throw new BusinessException(
        '凭证不存在或不属于当前工作区',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return credential;
  }

  private toResponse(credential: WorkspaceCredential): CredentialResponse {
    // 响应对象刻意不包含 secretEncrypted，避免密文通过 API 泄漏给前端。
    return {
      id: credential.id,
      workspaceId: credential.workspaceId,
      name: credential.name,
      type: credential.type,
      maskedHint: credential.maskedHint,
      config: credential.config,
      status: credential.status,
      lastUsedAt: credential.lastUsedAt
        ? formatShanghaiDateTime(credential.lastUsedAt)
        : null,
      createdBy: credential.createdBy,
      createdAt: formatShanghaiDateTime(credential.createdAt),
      updatedAt: formatShanghaiDateTime(credential.updatedAt),
    };
  }

  private toJsonInput(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | undefined {
    return value as Prisma.InputJsonValue | undefined;
  }

  private toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value;
    }

    return {};
  }
}
