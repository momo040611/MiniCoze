import {
  AgentConfig,
  ChatMessage,
  RuntimeAttachment,
  RuntimeEvent,
  RuntimeRunStatus,
  TokenUsage,
  ToolCall,
  ToolResult,
} from './agent';

// 一次 runtime 执行的共享上下文。
export interface RuntimeContext {
  runId: string;
  conversationId: string;
  agentId: string;
  userId: string;
  publicAccess?: {
    conversationIdPrefix: string;
  };
  status: RuntimeRunStatus;
  isPreview?: boolean;
  input: ChatMessage;
  attachments?: RuntimeAttachment[];
  history: ChatMessage[];
  agentConfig: AgentConfig;
  usage?: TokenUsage;
  // 本次运行累计的工具调用次数，由 runtime 在转发事件时累加，随 AgentRun 落库。
  toolCallCount?: number;
}

// 运行开始时的持久化元数据（写入 AgentRun 表）。
export interface RuntimeRunStartMeta {
  source: 'CHAT' | 'PUBLIC' | 'API';
  model?: string;
}

// runtime 的持久化边界，只关心 run 状态和会话历史。
export interface RuntimeRepository {
  saveRun(context: RuntimeContext, meta?: RuntimeRunStartMeta): Promise<void>;
  updateRunStatus(
    runId: string,
    status: RuntimeRunStatus,
    usage?: TokenUsage,
    error?: string,
  ): Promise<void>;
  appendMessage(runId: string, message: ChatMessage): Promise<void>;
  getConversationHistory(
    conversationId: string,
    limit?: number,
  ): Promise<ChatMessage[]>;
}

// 工具执行器由 runtime 注入，执行策略只负责调用，不关心工具来源。
export interface ToolExecutor {
  execute(input: {
    toolCall: ToolCall;
    context: RuntimeContext;
  }): Promise<ToolResult>;
}

export type AgentExecutionMode = 'single_agent' | 'workflow' | 'multi_agent';

export interface AgentExecutionInput {
  context: RuntimeContext;
  messages: ChatMessage[];
  toolExecutor: ToolExecutor;
  // 取消信号：执行策略在每个循环边界检查，配合 ai-gateway 的请求级 abort。
  signal?: AbortSignal;
  // 工具调用轮次上限，防止模型死循环；由 runtime 从工作区运行设置读取。
  maxToolRounds?: number;
}

// runtime 只依赖执行策略抽象，具体循环由策略实现。
export interface AgentExecutionStrategy {
  readonly mode: AgentExecutionMode;
  stream(
    input: AgentExecutionInput,
  ): AsyncGenerator<RuntimeEvent, string, void>;
}
