/**
 * 对话导出工具函数
 * 支持导出为 Markdown 格式
 */

interface ExportMessage {
  sender: 'user' | 'agent';
  text: string;
  time: string;
  agentName?: string;
}

interface ExportOptions {
  title?: string;
  agentName?: string;
  format: 'markdown';
}

/**
 * 将对话消息导出为 Markdown 格式
 */
export function exportConversationAsMarkdown(
  messages: ExportMessage[],
  options: ExportOptions = { format: 'markdown' },
): string {
  const lines: string[] = [];
  const title = options.title || '对话记录';
  const agentName = options.agentName || 'AI';
  const exportTime = new Date().toLocaleString('zh-CN');

  // 标题和元信息
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> **智能体**: ${agentName}`);
  lines.push(`> **导出时间**: ${exportTime}`);
  lines.push(`> **消息数量**: ${messages.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 消息内容
  messages.forEach((msg) => {
    const senderLabel = msg.sender === 'user' ? '👤 用户' : `🤖 ${msg.agentName || agentName}`;
    lines.push(`### ${senderLabel}  _${msg.time}_`);
    lines.push('');
    lines.push(msg.text);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * 下载文本文件
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出对话并下载
 */
export function exportAndDownload(
  messages: ExportMessage[],
  options?: Partial<ExportOptions>,
): void {
  const markdown = exportConversationAsMarkdown(messages, {
    format: 'markdown',
    ...options,
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `对话记录_${timestamp}.md`;

  downloadTextFile(markdown, filename);
}
