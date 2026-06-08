import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { chunkCustom } from '../chunk-custom';
import { chunkDefault } from '../chunk-default';
import { DEFAULT_CUSTOM_CONFIG } from '../types';

const baseCfg = {
  chunkType: 'custom' as const,
  chunkSize: 10,
  overlap: 0,
  separator: '\n\n',
  trimSpace: false,
  trimUrlAndEmail: false,
};

describe('chunkCustom', () => {
  it('英文文本按 chunkSize 切分，长度均 <= chunkSize', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz';
    const chunks = chunkCustom(text, { ...baseCfg, chunkSize: 10, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.charCount).toBeLessThanOrEqual(10);
      expect(Array.from(c.content).length).toBe(c.charCount);
    }
    expect(chunks.map((c) => c.content).join('')).toBe(text);
    expect(chunks[0].index).toBe(0);
    expect(chunks[chunks.length - 1].index).toBe(chunks.length - 1);
  });

  it('按 separator 分段，独立成 chunk', () => {
    const text = '段落一\n\n段落二';
    const chunks = chunkCustom(text, { ...baseCfg, chunkSize: 100, overlap: 0 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe('段落一');
    expect(chunks[1].content).toBe('段落二');
  });

  it('overlap 比例生效：相邻 chunk 的尾首重叠 rune 一致', () => {
    // chunkSize=10, overlap=20% => 2 rune overlap
    const text = 'abcdefghijklmnopqrstuvwxyz';
    const chunks = chunkCustom(text, { ...baseCfg, chunkSize: 10, overlap: 20 });
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = Array.from(chunks[i - 1].content).slice(-2).join('');
      const currHead = Array.from(chunks[i].content).slice(0, 2).join('');
      expect(currHead).toBe(prevTail);
    }
  });

  it('空字符串返回空数组', () => {
    expect(chunkCustom('', baseCfg)).toEqual([]);
  });

  it('文本短于 chunkSize 时单一 chunk', () => {
    const chunks = chunkCustom('hi', { ...baseCfg, chunkSize: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('hi');
    expect(chunks[0].charCount).toBe(2);
  });

  it('多字节 emoji 按 rune 切分，不出现半个字符', () => {
    const text = '😀😀😀😀😀😀😀😀'; // 8 个 emoji
    const chunks = chunkCustom(text, { ...baseCfg, chunkSize: 3, overlap: 0 });
    for (const c of chunks) {
      // 每个 emoji 是单 rune，content 重新转 rune 数组应整除
      expect(Array.from(c.content).every((ch) => ch === '😀')).toBe(true);
    }
    expect(chunks.map((c) => c.content).join('')).toBe(text);
  });

  it('overlap >= chunkSize 抛 BusinessException 且错误码为 KnowledgeChunkConfigInvalid', () => {
    expect(() =>
      chunkCustom('abc', { ...baseCfg, chunkSize: 10, overlap: 100 }),
    ).toThrow(BusinessException);
    try {
      chunkCustom('abc', { ...baseCfg, chunkSize: 10, overlap: 100 });
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }
  });

  it('trimUrlAndEmail=true 移除 url 与 email', () => {
    const text = 'visit https://example.com or mail a@b.com please';
    const chunks = chunkCustom(text, {
      ...baseCfg,
      chunkSize: 1000,
      trimUrlAndEmail: true,
      trimSpace: true,
    });
    const joined = chunks.map((c) => c.content).join('');
    expect(joined).not.toMatch(/https?:\/\//);
    expect(joined).not.toMatch(/@/);
  });

  it('trimSpace=true 折叠多空格并裁首尾', () => {
    const text = '   hello    world   ';
    const chunks = chunkCustom(text, {
      ...baseCfg,
      chunkSize: 1000,
      trimSpace: true,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('hello world');
  });
});

describe('chunkDefault', () => {
  it('与同参 chunkCustom 输出严格相等', () => {
    const text = '段落一\n\n段落二段落二段落二段落二';
    const a = chunkDefault(text);
    const b = chunkCustom(text, {
      chunkType: 'custom',
      ...DEFAULT_CUSTOM_CONFIG,
    });
    expect(a).toEqual(b);
  });
});
