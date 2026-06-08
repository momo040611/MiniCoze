/**
 * 剪贴板操作工具函数
 * 统一处理复制逻辑，支持安全上下文检测和降级方案
 */

import { message } from 'antd';

/**
 * 降级复制方案：使用 textarea + execCommand
 * 适用于非安全上下文（HTTP）或 Clipboard API 不可用时
 */
function fallbackCopy(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const success = document.execCommand('copy');
    if (!success) throw new Error('execCommand returned false');
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * 复制文本到剪贴板
 * 优先使用 Clipboard API，失败时降级到 execCommand
 * @param text 要复制的文本
 * @param showToast 是否显示提示消息，默认 true
 * @returns 是否复制成功
 */
export async function copyToClipboard(text: string, showToast = true): Promise<boolean> {
  try {
    // 安全上下文下优先使用 Clipboard API
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    if (showToast) message.success('已复制');
    return true;
  } catch {
    // 最终降级
    try {
      fallbackCopy(text);
      if (showToast) message.success('已复制');
      return true;
    } catch {
      if (showToast) message.error('复制失败，请手动选择文本复制');
      return false;
    }
  }
}
