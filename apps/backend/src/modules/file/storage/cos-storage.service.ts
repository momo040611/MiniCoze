import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import COS from 'cos-nodejs-sdk-v5';
import { Readable } from 'stream';
import {
  SaveFileInput,
  StorageFileStat,
  StorageService,
} from './storage.interface';

type CosCallbackResult = {
  Body?: Buffer | Uint8Array | string | Readable;
  ContentLength?: number | string;
  headers?: Record<string, string | number | undefined>;
};

type CosOperation = 'putObject' | 'getObject' | 'headObject' | 'deleteObject';
type CosObjectParams =
  | COS.PutObjectParams
  | COS.GetObjectParams
  | COS.HeadObjectParams
  | COS.DeleteObjectParams;

interface CosConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

@Injectable()
export class CosStorageService implements StorageService {
  private cosClient?: COS;

  constructor(private readonly configService: ConfigService) {}

  async save(input: SaveFileInput): Promise<void> {
    await this.callCos('putObject', {
      ...this.createObjectParams(input.storageKey),
      Body: input.buffer,
    });
  }

  async getStream(storageKey: string): Promise<Readable> {
    const data = await this.callCos('getObject', {
      ...this.createObjectParams(storageKey),
    });

    const body = data.Body;
    if (body instanceof Readable) {
      return body;
    }

    if (Buffer.isBuffer(body)) {
      return Readable.from(body);
    }

    if (body instanceof Uint8Array) {
      return Readable.from(Buffer.from(body));
    }

    if (typeof body === 'string') {
      return Readable.from(Buffer.from(body));
    }

    throw new Error('COS object body is empty');
  }

  async getStat(storageKey: string): Promise<StorageFileStat> {
    const data = await this.callCos('headObject', {
      ...this.createObjectParams(storageKey),
    });
    const size = this.getContentLength(data);

    if (size === null) {
      throw new Error('COS object content length is missing');
    }

    return { size };
  }

  async remove(storageKey: string): Promise<void> {
    await this.callCos('deleteObject', {
      ...this.createObjectParams(storageKey),
    });
  }

  private createObjectParams(storageKey: string) {
    const config = this.getCosConfig();

    return {
      Bucket: config.bucket,
      Region: config.region,
      Key: storageKey,
    };
  }

  private async callCos(
    operation: CosOperation,
    params: CosObjectParams,
  ): Promise<CosCallbackResult> {
    const cosClient = this.getCosClient();

    switch (operation) {
      case 'putObject':
        return cosClient.putObject(params as COS.PutObjectParams);
      case 'getObject':
        return cosClient.getObject(params as COS.GetObjectParams);
      case 'headObject':
        return cosClient.headObject(params);
      case 'deleteObject':
        return cosClient.deleteObject(params);
    }
  }

  private getCosClient() {
    if (!this.cosClient) {
      const config = this.getCosConfig();
      this.cosClient = new COS({
        SecretId: config.secretId,
        SecretKey: config.secretKey,
      });
    }

    return this.cosClient;
  }

  private getCosConfig(): CosConfig {
    const config = {
      secretId: this.configService.get<string>('file.cos.secretId'),
      secretKey: this.configService.get<string>('file.cos.secretKey'),
      bucket: this.configService.get<string>('file.cos.bucket'),
      region: this.configService.get<string>('file.cos.region'),
    };

    const missingKeys = Object.entries(config)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingKeys.length > 0) {
      throw new Error(`COS config is missing: ${missingKeys.join(', ')}`);
    }

    return config as CosConfig;
  }

  private getContentLength(data: CosCallbackResult) {
    const contentLength =
      data.ContentLength ?? data.headers?.['content-length'];

    if (contentLength === undefined) {
      return null;
    }

    const size = Number(contentLength);
    return Number.isFinite(size) ? size : null;
  }
}
