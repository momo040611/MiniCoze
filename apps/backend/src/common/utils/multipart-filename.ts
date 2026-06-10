/**
 * multer 在解析 multipart/form-data 时把 filename 字节流当 latin1 处理
 * （busboy 的 defParamCharset 默认为 'latin1'）。
 *
 * 当客户端未使用 RFC 5987 扩展参数时，UTF-8 中文文件名会被错解成 mojibake，
 * 例如 "歌曲分析报告.txt" → "æ­æ²åæ.txt"。
 *
 * 现代浏览器通常会用 `filename*=UTF-8''...` 正确编码，此时文件名已被 busboy
 * 正确解码。若对所有文件名粗暴执行 latin1→utf8 会导致已正确解码的中文被截断
 * 低位字节（Buffer.from 在 latin1 下只保留 & 0xFF），造成二次乱码。
 *
 * 因此仅当文件名中**全部字符都在 Latin-1 范围内**（≤ 0xFF）时才尝试解码；
 * 已含中文等高位字符的直接返回。
 */
export function decodeMultipartFilename(name: string): string {
  if (!name) return name;

  // 若已包含非 Latin-1 字符（如中文），说明 busboy 已正确解码，直接返回
  for (let i = 0; i < name.length; i++) {
    if (name.charCodeAt(i) > 0xff) {
      return name;
    }
  }

  // 全量字符在 0-255 范围内，可能是 mojibake 或纯 ASCII
  // latin1→utf8 对纯 ASCII 是恒等变换，安全
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}
