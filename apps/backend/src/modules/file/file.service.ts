import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileAsset,
  FilePurpose,
  FileStatus,
  FileVisibility,
  Prisma,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import path from 'path';
import type { Readable } from 'stream';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { CurrentUser } from '../../shared/types/current-user.type';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { FileQueryDto } from './dto/file-query.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileListResponse, FileResponse } from './types/file-response.type';
import { UploadedFile } from './types/uploaded-file.type';
import { FILE_STORAGE } from './storage/storage.interface';
import type { StorageService } from './storage/storage.interface';

@Injectable()
export class FileService {
  private readonly publicPurposes = new Set<FilePurpose>([
    FilePurpose.USER_AVATAR,
    FilePurpose.WORKSPACE_AVATAR,
    FilePurpose.AGENT_AVATAR,
    FilePurpose.PLUGIN_ICON,
  ]);

  private readonly imagePurposes = new Set<FilePurpose>([
    FilePurpose.USER_AVATAR,
    FilePurpose.WORKSPACE_AVATAR,
    FilePurpose.AGENT_AVATAR,
    FilePurpose.PLUGIN_ICON,
  ]);

  private readonly attachmentPurposes = new Set<FilePurpose>([
    FilePurpose.CHAT_ATTACHMENT,
    FilePurpose.WORKFLOW_ATTACHMENT,
    FilePurpose.TEMP_UPLOAD,
  ]);

  private readonly imageMimeTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
  ]);

  private readonly documentMimeTypes = new Set([
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    @Inject(FILE_STORAGE)
    private readonly storageService: StorageService,
  ) {}

  async upload(
    userId: string,
    file: UploadedFile | undefined,
    uploadFileDto: UploadFileDto,
  ): Promise<FileResponse> {
    if (!file?.buffer) {
      throw new BusinessException(
        '请上传文件',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.validateFile(file, uploadFileDto);
    await this.ensureUploadPermission(userId, uploadFileDto);

    // Multer 按 Latin-1 解析 multipart 中的文件名，导致中文等 UTF-8 字符乱码。
    // 这里回退解码：Latin-1 字节 → 原始 UTF-8 字符串。
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const extension = this.getExtension(originalName);
    const storageKey = this.createStorageKey(uploadFileDto.purpose, extension);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    await this.storageService.save({
      buffer: file.buffer,
      storageKey,
    });

    try {
      const createdFile = await this.prisma.fileAsset.create({
        data: {
          workspaceId: uploadFileDto.workspaceId,
          ownerId: userId,
          purpose: uploadFileDto.purpose,
          visibility: this.getDefaultVisibility(uploadFileDto.purpose),
          status: FileStatus.READY,
          originalName: originalName,
          storageKey,
          mimeType: file.mimetype,
          extension,
          size: file.size,
          checksum,
        },
      });

      const fileAsset = await this.prisma.fileAsset.update({
        where: {
          id: createdFile.id,
        },
        data: {
          url: this.createFileUrl(createdFile.id),
        },
      });

      return this.toFileResponse(fileAsset);
    } catch (error) {
      await this.storageService.remove(storageKey);
      throw error;
    }
  }

  async getContent(
    fileId: string,
    currentUser?: CurrentUser | null,
  ): Promise<{ fileAsset: FileAsset; stream: Readable; size: number }> {
    const fileAsset = await this.findReadyFileOrThrow(fileId);
    await this.ensureReadPermission(fileAsset, currentUser);

    const [stream, fileStat] = await Promise.all([
      this.storageService.getStream(fileAsset.storageKey),
      this.storageService.getStat(fileAsset.storageKey),
    ]);

    return {
      fileAsset,
      stream,
      size: fileStat.size,
    };
  }

  async findAllForUser(
    userId: string,
    query: FileQueryDto,
  ): Promise<FileListResponse> {
    const { page, pageSize, workspaceId, purpose, keyword } = query;
    const status = query.status ?? FileStatus.READY;

    if (workspaceId) {
      await this.workspaceAccessService.ensureMember(userId, workspaceId);
    }

    const where: Prisma.FileAssetWhereInput = {
      status,
      ...(workspaceId ? { workspaceId } : { ownerId: userId }),
      ...(purpose ? { purpose } : {}),
      ...(keyword
        ? {
            originalName: {
              contains: keyword,
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {}),
    };

    const [files, total] = await this.prisma.$transaction([
      this.prisma.fileAsset.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      items: files.map((fileAsset) => this.toFileResponse(fileAsset)),
      total,
      page,
      pageSize,
    };
  }

  async findOneForUser(
    fileId: string,
    currentUser: CurrentUser,
  ): Promise<FileResponse> {
    const fileAsset = await this.findReadyFileOrThrow(fileId);
    await this.ensureReadPermission(fileAsset, currentUser);

    return this.toFileResponse(fileAsset);
  }

  async getReadyFileForUser(
    fileId: string,
    currentUser: CurrentUser,
  ): Promise<FileAsset> {
    const fileAsset = await this.findReadyFileOrThrow(fileId);
    await this.ensureReadPermission(fileAsset, currentUser);
    return fileAsset;
  }

  async getReadyFileForInternal(fileId: string): Promise<FileAsset> {
    return this.findReadyFileOrThrow(fileId);
  }

  async getFileBufferForInternal(fileId: string): Promise<Buffer> {
    const stream = await this.getFileStreamForInternal(fileId);
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      const normalizedChunk = Buffer.isBuffer(chunk)
        ? Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
        : Buffer.from(typeof chunk === 'string' ? chunk : String(chunk));
      chunks.push(normalizedChunk);
    }

    return Buffer.concat(chunks);
  }

  async getFileStreamForInternal(fileId: string): Promise<Readable> {
    const fileAsset = await this.findReadyFileOrThrow(fileId);
    return this.storageService.getStream(fileAsset.storageKey);
  }

  async remove(userId: string, fileId: string): Promise<FileResponse> {
    const fileAsset = await this.findReadyFileOrThrow(fileId);
    await this.ensureDeletePermission(userId, fileAsset);

    const deletedFile = await this.prisma.fileAsset.update({
      where: {
        id: fileId,
      },
      data: {
        status: FileStatus.DELETED,
        deletedAt: new Date(),
      },
    });

    return this.toFileResponse(deletedFile);
  }

  private validateFile(file: UploadedFile, uploadFileDto: UploadFileDto) {
    if (file.size <= 0) {
      throw new BusinessException(
        '文件内容不能为空',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const maxSize = this.getMaxSize(uploadFileDto.purpose);
    if (file.size > maxSize) {
      throw new BusinessException(
        '文件大小超过限制',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const allowedMimeTypes = this.getAllowedMimeTypes(uploadFileDto.purpose);
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BusinessException(
        '不支持的文件类型',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      uploadFileDto.purpose !== FilePurpose.USER_AVATAR &&
      !uploadFileDto.workspaceId
    ) {
      throw new BusinessException(
        '上传该类型文件时必须提供 workspaceId',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async ensureUploadPermission(
    userId: string,
    uploadFileDto: UploadFileDto,
  ) {
    if (uploadFileDto.workspaceId) {
      await this.workspaceAccessService.ensureMember(
        userId,
        uploadFileDto.workspaceId,
      );
    }
  }

  private async ensureReadPermission(
    fileAsset: FileAsset,
    currentUser?: CurrentUser | null,
  ) {
    if (fileAsset.visibility === FileVisibility.PUBLIC) {
      return;
    }

    if (!currentUser) {
      throw new BusinessException(
        '请先登录',
        ErrorCode.Unauthorized,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (fileAsset.ownerId === currentUser.id) {
      return;
    }

    if (fileAsset.workspaceId) {
      await this.workspaceAccessService.ensureMember(
        currentUser.id,
        fileAsset.workspaceId,
      );
      return;
    }

    throw new BusinessException(
      '无权访问该文件',
      ErrorCode.Forbidden,
      HttpStatus.FORBIDDEN,
    );
  }

  private async ensureDeletePermission(userId: string, fileAsset: FileAsset) {
    if (fileAsset.ownerId === userId) {
      return;
    }

    if (fileAsset.workspaceId) {
      await this.workspaceAccessService.ensureCanManage(
        userId,
        fileAsset.workspaceId,
      );
      return;
    }

    throw new BusinessException(
      '无权删除该文件',
      ErrorCode.Forbidden,
      HttpStatus.FORBIDDEN,
    );
  }

  private async findReadyFileOrThrow(fileId: string) {
    const fileAsset = await this.prisma.fileAsset.findFirst({
      where: {
        id: fileId,
        status: FileStatus.READY,
      },
    });

    if (!fileAsset) {
      throw new BusinessException(
        '文件不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return fileAsset;
  }

  private getAllowedMimeTypes(purpose: FilePurpose) {
    if (this.imagePurposes.has(purpose)) {
      return this.imageMimeTypes;
    }

    if (this.attachmentPurposes.has(purpose)) {
      return new Set([...this.imageMimeTypes, ...this.documentMimeTypes]);
    }

    return this.documentMimeTypes;
  }

  private getMaxSize(purpose: FilePurpose) {
    if (this.imagePurposes.has(purpose)) {
      return this.configService.get<number>('file.maxImageSize') ?? 5242880;
    }

    return this.configService.get<number>('file.maxDocumentSize') ?? 52428800;
  }

  private getDefaultVisibility(purpose: FilePurpose) {
    return this.publicPurposes.has(purpose)
      ? FileVisibility.PUBLIC
      : FileVisibility.PRIVATE;
  }

  private createStorageKey(purpose: FilePurpose, extension: string | null) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const folder = purpose.toLowerCase().replaceAll('_', '-');
    const fileName = `${randomUUID()}${extension ?? ''}`;

    return `${folder}/${year}/${month}/${fileName}`;
  }

  private createFileUrl(fileId: string) {
    const publicBaseUrl =
      this.configService.get<string>('file.publicBaseUrl') ?? '/api/files';

    return `${publicBaseUrl.replace(/\/$/, '')}/${fileId}/content`;
  }

  private getExtension(originalName: string) {
    const extension = path.extname(originalName).toLowerCase();
    return extension || null;
  }

  private toFileResponse(fileAsset: FileAsset): FileResponse {
    return {
      id: fileAsset.id,
      workspaceId: fileAsset.workspaceId,
      ownerId: fileAsset.ownerId,
      purpose: fileAsset.purpose,
      visibility: fileAsset.visibility,
      status: fileAsset.status,
      originalName: fileAsset.originalName,
      mimeType: fileAsset.mimeType,
      extension: fileAsset.extension,
      size: fileAsset.size,
      url: fileAsset.url,
      deletedAt: fileAsset.deletedAt
        ? formatShanghaiDateTime(fileAsset.deletedAt)
        : null,
      createdAt: formatShanghaiDateTime(fileAsset.createdAt),
      updatedAt: formatShanghaiDateTime(fileAsset.updatedAt),
    };
  }
}
