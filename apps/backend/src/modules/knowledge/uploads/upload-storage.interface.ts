// 文件存储抽象：本期落地为本地磁盘，二期可换 S3 / OSS。
// 仅负责字节流的 put/get/remove/exists，元数据由 UploadStageService 管。

export const UPLOAD_STORAGE_TOKEN = Symbol('UPLOAD_STORAGE_TOKEN');

export interface PutResult {
  fileId: string;
  storagePath: string;
}

export interface UploadStorage {
  /**
   * 写入文件。fileId 由实现自动生成。
   * @param buffer 文件字节
   * @param extension 文件扩展名（不含点，如 'txt'/'md'），决定文件名后缀
   */
  put(buffer: Buffer, extension: string): Promise<PutResult>;

  /** 读文件。文件不存在返回 null。 */
  get(fileId: string): Promise<Buffer | null>;

  /** 删文件。不存在视为成功（幂等）。 */
  remove(fileId: string): Promise<void>;

  /** 文件是否存在。 */
  exists(fileId: string): Promise<boolean>;
}
