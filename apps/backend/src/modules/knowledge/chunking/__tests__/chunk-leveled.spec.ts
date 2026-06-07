import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { chunkLeveled } from '../chunk-leveled';

describe('chunkLeveled', () => {
  it('多级标题切分，saveTitle=true 时前置祖先标题路径', () => {
    const md = [
      '# 第一章',
      '引言',
      '## 1.1 概览',
      '概览正文',
      '### 详情',
      '详情正文',
      '## 1.2 进阶',
      '进阶正文',
    ].join('\n');
    const chunks = chunkLeveled(md, {
      chunkType: 'leveled',
      maxDepth: 3,
      saveTitle: true,
    });
    // 4 个标题 -> 4 个 chunk
    expect(chunks).toHaveLength(4);
    // 第一个 chunk 含 "# 第一章" 和 "引言"
    expect(chunks[0].content).toContain('# 第一章');
    expect(chunks[0].content).toContain('引言');
    // 第三个 chunk 应包含三层祖先标题
    expect(chunks[2].content).toContain('# 第一章');
    expect(chunks[2].content).toContain('## 1.1 概览');
    expect(chunks[2].content).toContain('### 详情');
    expect(chunks[2].content).toContain('详情正文');
    // 第四个 chunk 是 ## 1.2，应只含 # 与 ## 两层（不含 ### 详情）
    expect(chunks[3].content).toContain('## 1.2 进阶');
    expect(chunks[3].content).not.toContain('### 详情');
  });

  it('saveTitle=false 时不前置祖先标题', () => {
    const md = '# A\n正文a\n## B\n正文b';
    const chunks = chunkLeveled(md, {
      chunkType: 'leveled',
      maxDepth: 3,
      saveTitle: false,
    });
    expect(chunks).toHaveLength(2);
    expect(chunks[1].content).not.toContain('# A');
    expect(chunks[1].content).toContain('## B');
    expect(chunks[1].content).toContain('正文b');
  });

  it('maxDepth=2 时 ### 标题被当作正文不切分', () => {
    const md = '# A\n## B\nbb\n### C\ncc';
    const chunks = chunkLeveled(md, {
      chunkType: 'leveled',
      maxDepth: 2,
      saveTitle: true,
    });
    // 仅 # 和 ## 形成边界，### 视为 ## 段落内的正文
    expect(chunks).toHaveLength(2);
    expect(chunks[1].content).toContain('### C');
    expect(chunks[1].content).toContain('cc');
  });

  it('全文无标题时返回单个包含全部正文的 chunk', () => {
    const md = '只有正文\n第二行';
    const chunks = chunkLeveled(md, {
      chunkType: 'leveled',
      maxDepth: 3,
      saveTitle: true,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('只有正文');
    expect(chunks[0].content).toContain('第二行');
  });

  it('同级连续标题：第二个不挂在第一个之下', () => {
    const md = '## A\naa\n## B\nbb';
    const chunks = chunkLeveled(md, {
      chunkType: 'leveled',
      maxDepth: 3,
      saveTitle: true,
    });
    expect(chunks).toHaveLength(2);
    expect(chunks[1].content).toContain('## B');
    expect(chunks[1].content).not.toContain('## A');
  });

  it('跳级标题：# 直接跳到 ###，祖先栈仍正确', () => {
    const md = '# A\n## skip not present\n### C\ncc';
    // 实际仅有 # 和 ###，没有 ##
    const md2 = '# A\n### C\ncc';
    const chunks = chunkLeveled(md2, {
      chunkType: 'leveled',
      maxDepth: 3,
      saveTitle: true,
    });
    // # A 引言段为空内容则不出 chunk；这里约定：标题本身就是一个 chunk 起点
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const last = chunks[chunks.length - 1];
    expect(last.content).toContain('# A');
    expect(last.content).toContain('### C');
    expect(last.content).toContain('cc');
  });

  it('空文档返回空数组', () => {
    expect(
      chunkLeveled('', { chunkType: 'leveled', maxDepth: 3, saveTitle: true }),
    ).toEqual([]);
  });

  it('maxDepth 越界抛 BusinessException', () => {
    expect(() =>
      chunkLeveled('# A', {
        chunkType: 'leveled',
        maxDepth: 0,
        saveTitle: true,
      }),
    ).toThrow(BusinessException);
    expect(() =>
      chunkLeveled('# A', {
        chunkType: 'leveled',
        maxDepth: 7,
        saveTitle: true,
      }),
    ).toThrow(BusinessException);
    try {
      chunkLeveled('# A', {
        chunkType: 'leveled',
        maxDepth: 0,
        saveTitle: true,
      });
    } catch (e) {
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeChunkConfigInvalid,
      );
    }
  });

  it('charCount 按 rune 计：含 emoji 标题', () => {
    const md = '# 标题😀\n正文';
    const chunks = chunkLeveled(md, {
      chunkType: 'leveled',
      maxDepth: 3,
      saveTitle: true,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].charCount).toBe(Array.from(chunks[0].content).length);
  });
});
