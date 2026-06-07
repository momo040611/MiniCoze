/**
 * multer 在解析 multipart/form-data 时把 filename 字节流当 latin1 处理
 * （这是 RFC 7578 时代的历史包袱）。当客户端实际传的是 UTF-8 中文文件名时，
 * 字节流会被错解成 mojibake，例如 "歌曲分析报告.txt" → "æ­æ²åæ.txt"。
 *
 * 这里把 latin1 字节按 UTF-8 重新解码恢复原文件名。
 * 当原文件名本来就是纯 ASCII，转码结果与原值一致；幂等无副作用。
 */
export function decodeMultipartFilename(name: string): string {
  if (!name) return name;
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}
