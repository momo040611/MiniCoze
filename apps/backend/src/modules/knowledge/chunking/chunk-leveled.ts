import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import type { Chunk, LeveledConfig } from './types';

const HEADING_REGEX = /^(#{1,6})\s+(.*)$/;

interface HeadingBlock {
  depth: number; // 1-6，0 表示文档开头无标题的引言
  title: string; // 标题文本（不含 #），引言为 ''
  ancestors: { depth: number; title: string }[]; // 祖先栈快照（不含自身）
  bodyLines: string[]; // 标题下到下一个同级或更高标题之前的所有原始行（不含本标题行）
}

/**
 * 层级切分：按 markdown ATX 标题的层级把文档切成 chunks。
 *
 * 简化点：
 *   - 仅识别 ATX 标题（`#`、`##`...），不处理 Setext。
 *   - 不解析 fenced code block，code 内的 `#` 行会被误识为标题（已在使用文档中说明）。
 *   - 深于 maxDepth 的标题视为正文行。
 */
export function chunkLeveled(md: string, cfg: LeveledConfig): Chunk[] {
  const maxChars = cfg.maxChars ?? 512;
  if (cfg.maxDepth < 1 || cfg.maxDepth > 6) {
    throw new BusinessException(
      'maxDepth must be between 1 and 6',
      ErrorCode.KnowledgeChunkConfigInvalid,
    );
  }
  if (md.length === 0) return [];

  const lines = md.split(/\r?\n/);

  const blocks: HeadingBlock[] = [];
  const stack: { depth: number; title: string }[] = []; // 当前祖先栈（含当前块自身）
  let current: HeadingBlock | null = null;

  const flushCurrent = () => {
    if (current) blocks.push(current);
  };

  for (const rawLine of lines) {
    const m = HEADING_REGEX.exec(rawLine);
    const depth = m ? m[1].length : 0;

    if (m && depth >= 1 && depth <= cfg.maxDepth) {
      // 弹出栈中深度 >= 当前深度的项（同级或更深的祖先不再是祖先）
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }
      // ancestors 是不含自身的快照
      const ancestors = stack.slice();
      const title = (m[2] ?? '').trim();
      // 推入自身到栈
      stack.push({ depth, title });

      flushCurrent();
      current = {
        depth,
        title,
        ancestors,
        bodyLines: [],
      };
    } else {
      // 引言（在第一个标题前）或正文行
      if (current === null) {
        current = {
          depth: 0,
          title: '',
          ancestors: [],
          bodyLines: [rawLine],
        };
      } else {
        current.bodyLines.push(rawLine);
      }
    }
  }
  flushCurrent();

  // 把每个 block 渲染为 chunk content，超限时按段落进一步切分
  const chunks: Chunk[] = [];
  for (const b of blocks) {
    const titleLines: string[] = [];
    if (cfg.saveTitle) {
      for (const a of b.ancestors) {
        titleLines.push(`${'#'.repeat(a.depth)} ${a.title}`);
      }
    }
    if (b.depth > 0) {
      titleLines.push(`${'#'.repeat(b.depth)} ${b.title}`);
    }

    const titlePrefix = titleLines.join('\n');
    const titleLen = titlePrefix.length;

    const bodyText = b.bodyLines.join('\n').replace(/^\n+|\n+$/g, '');

    if (titlePrefix.length === 0 && bodyText.length === 0) continue;

    // 标题 + 正文能放进 maxChars → 单个 chunk
    const fullContent = titlePrefix.length > 0 && bodyText.length > 0
      ? `${titlePrefix}\n\n${bodyText}`
      : titlePrefix.length > 0
        ? titlePrefix
        : bodyText;

    if (Array.from(fullContent).length <= maxChars) {
      chunks.push({
        index: chunks.length,
        content: fullContent,
        charCount: Array.from(fullContent).length,
      });
      continue;
    }

    // 超限 → 按段落切分 body，每组段落附上标题前缀
    const separator = titlePrefix.length > 0 ? `\n\n` : '';
    const overhead = titleLen + separator.length;
    const budget = Math.max(1, maxChars - overhead);

    const paragraphs = bodyText.split(/\n\n+/);
    const groups: string[][] = [];
    let currentGroup: string[] = [];
    let currentLen = 0;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed.length === 0) continue;
      const paraLen = Array.from(trimmed).length;
      // 单个段落本身超过 budget 时，至少把它放进自己一组（不丢内容）
      const needNewGroup = currentGroup.length > 0 && currentLen + paraLen + currentGroup.length * 2 > budget;
      if (needNewGroup) {
        groups.push(currentGroup);
        currentGroup = [];
        currentLen = 0;
      }
      currentGroup.push(trimmed);
      currentLen += paraLen;
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    for (const group of groups) {
      const groupBody = group.join('\n\n');
      const content = titlePrefix.length > 0
        ? `${titlePrefix}${separator}${groupBody}`
        : groupBody;

      if (content.length === 0) continue;

      chunks.push({
        index: chunks.length,
        content,
        charCount: Array.from(content).length,
      });
    }
  }

  return chunks;
}
