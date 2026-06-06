// Agent Runtime Mock — 模拟 SSE 流式对话，生成工具调用、知识库召回、工作流步骤等事件
// 用于 PreviewChat 调试面板的离线开发

import type {
  RunAgentParams,
  RunAgentCallbacks,
  RuntimeEvent,
  ToolCallCreatedEvent,
  ToolCallCompletedEvent,
  KnowledgeStatusEvent,
  MessageDeltaEvent,
  MessageCompletedEvent,
  RunCreatedEvent,
  RunCompletedEvent,
  StreamDoneEvent,
} from './index';

// ---- Mock 工具定义 ----

const MOCK_TOOLS = [
  { name: 'web_search', desc: '网络搜索', args: { query: '搜索关键词' } },
  { name: 'database_query', desc: '数据库查询', args: { sql: 'SELECT * FROM users LIMIT 10' } },
  { name: 'code_execute', desc: '代码执行', args: { code: 'console.log("hello")', language: 'javascript' } },
  { name: 'file_read', desc: '文件读取', args: { path: '/data/report.txt' } },
];

const MOCK_KNOWLEDGE_CHUNKS = [
  { id: 'chunk-1', content: 'React 18 引入了并发渲染机制，允许 React 同时准备多个版本的 UI。这是通过新的 root API 实现的。', score: 0.92, documentName: 'React 18 官方文档.md' },
  { id: 'chunk-2', content: 'Suspense 组件可以在子组件加载完成前展示备用内容，配合 React.lazy 实现代码分割。', score: 0.87, documentName: 'React 最佳实践.pdf' },
  { id: 'chunk-3', content: 'useTransition 和 useDeferredValue 是 React 18 新增的 Hook，用于管理优先级较低的状态更新。', score: 0.81, documentName: 'React Hooks 指南.md' },
];

const MOCK_WORKFLOW_STEPS = [
  { name: '开始', status: 'completed' },
  { name: '意图识别', status: 'completed' },
  { name: '知识库检索', status: 'completed' },
  { name: '条件判断', status: 'completed' },
  { name: '生成回复', status: 'completed' },
  { name: '结束', status: 'completed' },
];

// ---- Mock 回复模板 ----

const REPLY_TEMPLATES: Record<string, string[]> = {
  default: [
    '你好！我是 AI 助手，很高兴为你服务。请问有什么我可以帮助你的吗？',
    '这是一个很好的问题。让我来为你详细解答一下。\n\n首先，我们需要了解基本概念。然后逐步深入到具体的实现细节。',
    '根据我的分析，这个问题可以从几个角度来看：\n\n1. **技术层面**：需要考虑性能和可维护性\n2. **用户体验**：界面应该简洁直观\n3. **安全性**：数据保护是重中之重',
  ],
  code: [
    '关于代码问题，我建议如下：\n\n```typescript\nfunction solve(input: string): string {\n  // 处理逻辑\n  return input.trim();\n}\n```\n\n这段代码使用了简洁的函数式写法，易于理解和维护。',
    '让我帮你审查这段代码。发现以下几点：\n\n1. ✅ 变量命名清晰\n2. ⚠️ 缺少错误处理\n3. ❌ 存在潜在的内存泄漏\n\n建议添加 try-catch 包裹异步操作。',
  ],
  search: [
    '根据搜索结果，我找到了以下相关信息：\n\n**搜索结果摘要**：\n- 最新发布了相关技术文档\n- 社区讨论中有多个解决方案\n- 官方推荐的最佳实践已更新\n\n需要我深入分析某个方面吗？',
  ],
};

// ---- 辅助函数 ----

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getReplyCategory(message: string): string {
  const lower = message.toLowerCase();
  if (/代码|code|bug|函数|接口|报错/.test(lower)) return 'code';
  if (/搜索|查找|查询|search|找/.test(lower)) return 'search';
  return 'default';
}

function getReplyText(message: string, systemPrompt?: string): string {
  const category = getReplyCategory(message);
  const templates = REPLY_TEMPLATES[category] || REPLY_TEMPLATES.default;
  let reply = pick(templates);

  // 根据 systemPrompt 关键词调整回复
  if (systemPrompt) {
    if (/翻译|translate/i.test(systemPrompt)) {
      reply = `**翻译结果**：\n\n${message}\n\n→ Translation: This is a simulated translation result based on your system prompt configuration.`;
    } else if (/代码审查|code review/i.test(systemPrompt)) {
      reply = `## 代码审查报告\n\n**代码质量评分**: 8.5/10\n\n### 发现的问题\n1. ⚠️ 第 12 行：缺少类型注解\n2. ✅ 第 25 行：错误处理完善\n3. 💡 第 38 行：可以使用更简洁的写法\n\n### 建议\n- 增加单元测试覆盖率\n- 考虑使用 const 断言`;
    } else if (/客服|customer/i.test(systemPrompt)) {
      reply = `您好！感谢您的咨询。\n\n关于您的问题，我来为您解答：\n\n${message.length > 20 ? '我理解您的需求，' : ''}我们已经为您记录了这个问题，会在 24 小时内给您回复。\n\n如有其他问题，随时联系我们！`;
    }
  }

  return reply;
}

// ---- Mock 流式函数 ----

export async function runAgentStreamMock(
  params: RunAgentParams,
  callbacks: RunAgentCallbacks,
): Promise<AbortController> {
  const controller = new AbortController();
  const runId = `mock-run-${Date.now()}`;
  const conversationId = params.conversationId || `mock-conv-${Date.now()}`;
  const messageId = `mock-msg-${Date.now()}`;

  // 异步执行模拟流程
  (async () => {
    try {
      // 1. run.created
      await delay(100);
      if (controller.signal.aborted) return;
      callbacks.onEvent({
        type: 'run.created',
        runId,
        conversationId,
      } as RunCreatedEvent);

      // 2. run.in_progress
      await delay(100);
      if (controller.signal.aborted) return;
      callbacks.onEvent({ type: 'run.in_progress', runId });

      // 3. knowledge.status（如果配置了知识库或随机触发）
      const hasKnowledge = !!params.knowledgeBaseId || Math.random() > 0.4;
      if (hasKnowledge) {
        await delay(200);
        if (controller.signal.aborted) return;
        const bound = !!params.knowledgeBaseId || Math.random() > 0.3;
        const retrievedCount = bound ? Math.floor(Math.random() * 4) + 1 : 0;
        callbacks.onEvent({
          type: 'knowledge.status',
          runId,
          knowledge: bound
            ? { bound: true, knowledgeName: '产品知识库', retrievedCount }
            : { bound: false },
        } as KnowledgeStatusEvent);
      }

      // 4. tool.call.created + tool.call.completed（随机触发 1-2 个工具调用）
      const toolCallCount = Math.random() > 0.3 ? Math.floor(Math.random() * 2) + 1 : 0;
      for (let i = 0; i < toolCallCount; i++) {
        if (controller.signal.aborted) return;
        const tool = pick(MOCK_TOOLS);
        const toolCallId = `mock-tc-${Date.now()}-${i}`;

        await delay(300);
        if (controller.signal.aborted) return;
        callbacks.onEvent({
          type: 'tool.call.created',
          runId,
          toolCallId,
          name: tool.name,
          args: tool.args,
        } as ToolCallCreatedEvent);

        await delay(500 + Math.random() * 1000);
        if (controller.signal.aborted) return;

        // 15% 概率工具调用失败
        const toolFailed = Math.random() < 0.15;
        callbacks.onEvent({
          type: 'tool.call.completed',
          runId,
          toolCallId,
          name: tool.name,
          result: toolFailed ? null : { status: 'ok', data: `Mock ${tool.desc} 结果数据` },
          error: toolFailed ? `Mock 错误: ${tool.desc} 服务暂时不可用，请稍后重试` : undefined,
        } as ToolCallCompletedEvent);
      }

      // 5. message.delta（流式输出）
      const replyText = getReplyText(params.message, params.systemPrompt);
      const chunks = replyText.match(/.{1,8}/gs) || [replyText];

      for (const chunk of chunks) {
        if (controller.signal.aborted) return;
        await delay(30 + Math.random() * 50);
        callbacks.onEvent({
          type: 'message.delta',
          runId,
          messageId,
          content: chunk,
        } as MessageDeltaEvent);
      }

      // 6. message.completed
      await delay(100);
      if (controller.signal.aborted) return;
      callbacks.onEvent({
        type: 'message.completed',
        runId,
        messageId,
        content: replyText,
      } as MessageCompletedEvent);

      // 7. run.completed
      await delay(100);
      if (controller.signal.aborted) return;
      callbacks.onEvent({
        type: 'run.completed',
        runId,
        usage: {
          inputTokens: 120 + Math.floor(Math.random() * 200),
          outputTokens: 80 + Math.floor(Math.random() * 150),
          totalTokens: 200 + Math.floor(Math.random() * 350),
        },
      } as RunCompletedEvent);

      // 8. stream.done
      await delay(50);
      if (controller.signal.aborted) return;
      callbacks.onEvent({ type: 'stream.done', runId } as StreamDoneEvent);
    } catch (err) {
      if (!controller.signal.aborted) {
        callbacks.onError(err instanceof Error ? err : new Error('Mock 流式对话异常'));
      }
    }
  })();

  return controller;
}
