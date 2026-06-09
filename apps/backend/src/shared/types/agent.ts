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
  metadata?: RuntimeToolMetadata;
  maskedArgs?: unknown;
  maskedOutput?: unknown;
  maskedError?: string;
}

export interface RuntimeToolMetadata {
  toolKind?: 'plugin' | 'workflow';
  pluginId?: string;
  pluginCode?: string;
  toolCode?: string;
  workflowId?: string;
  workflowVersionId?: string;
  workflowBindingId?: string;
  workflowName?: string;
}

export interface RuntimeKnowledgeBindingConfig {
  topK?: number;
  minScore?: number;
}

export interface RuntimeKnowledgeBinding {
  bindingId: string;
  knowledgeBaseId: string;
  enabled: boolean;
  config?: RuntimeKnowledgeBindingConfig | null;
}

export interface RuntimeAttachment {
  fileId: string;
  name?: string;
  mimeType?: string;
  size?: number;
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
  knowledgeBindings?: RuntimeKnowledgeBinding[];
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
  | ({
      type: 'tool.call.created';
      runId: string;
      toolCallId: string;
      name: string;
      args: unknown;
    } & RuntimeToolMetadata)
  | ({
      type: 'tool.call.completed';
      runId: string;
      toolCallId: string;
      name: string;
      result: unknown;
      error?: string;
    } & RuntimeToolMetadata)
  | ({
      type: 'tool.call.failed';
      runId: string;
      toolCallId: string;
      name: string;
      error: string;
    } & RuntimeToolMetadata)
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
  publicAccess?: {
    conversationIdPrefix: string;
  };
  preview?: boolean;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  knowledgeBaseId?: string;
  attachments?: RuntimeAttachment[];
  publishedSnapshot?: {
    agent: {
      id: string;
      workspaceId: string;
      name: string;
      systemPrompt: string;
      model: string;
      temperature: number;
      contextLimit: number;
    };
    tools?: ToolDefinition[];
    knowledgeBindings?: RuntimeKnowledgeBinding[];
  };
}
