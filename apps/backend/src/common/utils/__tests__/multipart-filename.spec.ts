import { decodeMultipartFilename } from '../multipart-filename';

describe('decodeMultipartFilename', () => {
  it('latin1 字节流（实为 UTF-8 中文）→ 正确解码', () => {
    const original = '歌曲分析报告.txt';
    // multer 的处理：UTF-8 字节被错按 latin1 解读
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');
    expect(decodeMultipartFilename(mojibake)).toBe(original);
  });

  it('纯 ASCII 文件名 → 原样返回（幂等）', () => {
    expect(decodeMultipartFilename('readme.txt')).toBe('readme.txt');
    expect(decodeMultipartFilename('GUIDE-v1.md')).toBe('GUIDE-v1.md');
  });

  it('空字符串 → 空字符串', () => {
    expect(decodeMultipartFilename('')).toBe('');
  });

  it('emoji 文件名同样能恢复', () => {
    const original = '笔记😀.md';
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');
    expect(decodeMultipartFilename(mojibake)).toBe(original);
  });
});
