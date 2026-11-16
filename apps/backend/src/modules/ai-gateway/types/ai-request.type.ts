import type { ChatMessage, ToolDefinition } from '../../../shared/types/agent';

export interface AiGenerateRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  // 取消信号：传入后 Provider 的 fetch 会在 abort 时立即中断（含流式读取）。
  signal?: AbortSignal;
}
