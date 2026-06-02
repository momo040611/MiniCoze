// ── 消息相关 ──
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// ── 工具相关 ──
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  toolCallId: string;
  output: string;
}

// ── Agent 配置 ──
export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  contextLimit: number;
  tools: ToolDefinition[];
}

// ── 流式事件 ──
export type StreamEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_calls'; toolCalls: ToolCall[] }
  | { type: 'tool_result'; toolCallId: string; output: string }
  | { type: 'done'; messageId: string; conversationId: string }
  | { type: 'error'; message: string };

// ── 调用参数 ──
export interface AgentInvokeInput {
  agentId: string;
  message: string;
  conversationId?: string;
}

export interface AgentInvokeResult {
  messageId: string;
  conversationId: string;
  content: string;
}

// ---- Agent Runtime ----
export type RuntimeRunStatus =
  | 'created'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type KnowledgeBoundStatus =
  | { bound: false }
  | { bound: true; knowledgeName: string; retrievedCount?: number };

export type RuntimeEvent =
  | { type: 'run.created'; runId: string; conversationId: string }
  | { type: 'run.in_progress'; runId: string }
  | { type: 'message.delta'; runId: string; messageId: string; content: string }
  | {
      type: 'message.completed';
      runId: string;
      messageId: string;
      content: string;
    }
  | {
      type: 'tool.call.created';
      runId: string;
      toolCallId: string;
      name: string;
      args: unknown;
    }
  | {
      type: 'tool.call.completed';
      runId: string;
      toolCallId: string;
      name: string;
      result: unknown;
      error?: string;
    }
  | {
      type: 'knowledge.status';
      runId: string;
      knowledge: KnowledgeBoundStatus;
    }
  | { type: 'run.completed'; runId: string; usage?: TokenUsage }
  | { type: 'run.failed'; runId: string; error: string }
  | { type: 'stream.done'; runId: string };

export interface RunAgentCommand {
  agentId: string;
  userId: string;
  message: string;
  conversationId?: string;
  preview?: boolean;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  knowledgeBaseId?: string;
}
