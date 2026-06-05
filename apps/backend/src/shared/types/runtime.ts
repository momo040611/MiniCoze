import {
  AgentConfig,
  ChatMessage,
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
  status: RuntimeRunStatus;
  isPreview?: boolean;
  input: ChatMessage;
  history: ChatMessage[];
  agentConfig: AgentConfig;
  usage?: TokenUsage;
}

// runtime 的持久化边界，只关心 run 状态和会话历史。
export interface RuntimeRepository {
  saveRun(context: RuntimeContext): Promise<void>;
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
}

// runtime 只依赖执行策略抽象，具体循环由策略实现。
export interface AgentExecutionStrategy {
  readonly mode: AgentExecutionMode;
  stream(
    input: AgentExecutionInput,
  ): AsyncGenerator<RuntimeEvent, string, void>;
}
