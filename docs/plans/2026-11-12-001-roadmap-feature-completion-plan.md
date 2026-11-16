---
title: 'roadmap: MiniCoze 功能补齐计划书'
type: roadmap
status: done
date: 2026-11-12
origin: 2026-11-11 前后端功能差距审阅（对话产出）
progress:
  date: 2026-11-13
  done: ['1.1', '1.2', '1.3', '1.4(SSRF guard 工具层+HTTP 插件)', '1.5', '1.6', '2.1', '2.2', '2.3', '2.3部分(附件/知识库解析)', '2.4', '2.5', '3.1', '3.2(前后端闭环：凭据 UI + HTTP 引导表单)', '3.3', '3.4', '3.5', '3.6', '3.7', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '文档状态映射修复(retry 接通 reprocess)']
  pending: []
---

# MiniCoze 功能补齐计划书

> **进度（2026-11-13）**：计划内全部项目已落地，`progress.pending` 清空。后端 tsc 通过 + jest 168/168，前端 `tsc -b` 通过。

## Overview

基于 2026-11-11 的前后端全量审阅：核心链路（搭 Agent → 绑插件/知识库/工作流 → SSE 流式运行 → 发布 → 公开访问）已闭环。本计划书将剩余差距按 **四个阶段（M1–M4）** 排期，原则：先堵安全与稳定性硬伤，再修数据一致性，最后补功能面与体验。每项给出涉及文件、验收标准（AC）。

---

## Phase 1 (M1)：安全与稳定性硬伤 — P0

### 1.1 工具循环轮次上限 + 运行超时

- **问题**：`single-agent-runner.ts:39` 的 `for(;;)` 无上限；`WorkspaceRuntimeSetting.maxToolRounds / maxRunDurationMs / requestTimeoutMs / retryCount` 六个字段只存不读。
- **改法**：
  1. `SingleAgentRunner` 循环内读取当前 workspace 的 `WorkspaceRuntimeSetting`，超限发 `run.failed`（错误码 `TOOL_ROUNDS_EXCEEDED`）。
  2. 外层加 `maxRunDurationMs` 总超时（AbortController 贯穿到 ai-gateway 请求）。
  3. DTO 增加可覆盖字段（请求级 `maxToolRounds`），默认取工作区配置。
- **AC**：构造一个每次都要求调工具的 Agent，在 N 轮后收到明确的失败事件而非无限流；总时长超限同理。

### 1.2 Agent 运行真取消

- **问题**：`agent-runtime.service.ts:49-51` `cancel()` 空实现；前端停止按钮只断 SSE。
- **改法**：
  1. 运行上下文注册表（Map<runId, AbortController>）+ `POST /agent-runs/:runId/cancel`。
  2. Abort 信号贯穿：模型流读取、工具执行（插件调用/工作流运行）、SSE 写出。
  3. 取消后落库消息状态（`Message.metadata.aborted=true`）。
- **AC**：流式中途调用取消接口后：后端停止调用模型/工具，DB 中该轮消息有中断标记，再次提问不受影响。

### 1.3 code 节点沙箱加固

- **问题**：`code-node.executor.ts` 用 `node:vm`，注释自承非安全沙箱。
- **改法**（务实路线，不引入新进程模型）：
  - 移除 `vm`，改用受限解释执行：仅允许纯 JS 表达式子集（可用 acorn 解析 + 白名单校验禁止 `require/process/globalThis/import`），或接入 `isolated-vm`（二选一，倾向后者，独立 npm 依赖、成熟）。
  - 内存上限 + 已有 1s 超时保留。
- **AC**：恶意代码（读 env、require、死循环、超大字符串）全部被拒绝或超时，正常转换脚本可用。

### 1.4 http 节点 SSRF 防护

- **改法**：抽取 `ssrf-guard.ts`：DNS 解析后校验 IP 非私网/环回/链路本地（169.254.*）、禁非 http(s) 协议、禁重定向到私网、可选域名白名单（读渠道配置）。
- **AC**：`http://127.0.0.1`、`http://169.254.169.254/`、内网 IP 重定向均被拦截并返回明确错误。

### 1.5 发布渠道限流/白名单生效

- **问题**：`PublishChannel.config` 的 `rateLimitPerMinute / allowedIps / allowedOrigins` 只存储、不校验。
- **改法**：`public-agent` / `public-workflow` 入口加守卫：内存滑动窗口限流（同 IP+渠道维度）、IP 白名单、Origin 校验（WEB 渠道 CORS 已有，API 渠道补齐）。
- **AC**：超限返回 429；非白名单 IP/Origin 返回 403。

### 1.6 探针与分页加固（小项打包）

- health 探活：Prisma `$queryRaw SELECT 1`，区分 liveness/readiness。
- `PaginationQueryDto` 补 `@Max(100)` 类上限校验。

**M1 验收**：以上 6 项全部落地 + 各补最小单测（runner 循环上限、ssrf-guard、限流器 3 个是重点）。

---

## Phase 2 (M2)：数据一致性 — P1

### 2.1 AgentRun 持久化（结构性最重要）

- **新增**：Prisma 模型 `AgentRun`（id/runId/agentId/conversationId/messageId/userId/workspaceId/source(CHAT|PUBLIC|API)/status/model/startedAt/finishedAt/durationMs/promptTokens/completionTokens/toolCallCount/error）+ migration。
- **改法**：`RuntimePrismaRepository` 从进程内 Map 改为落 `AgentRun`；`cancel` 查表定位运行。
- **配套**：`GET /agent-runs?agentId=&workspaceId=` 分页查询接口 + 前端"运行历史"入口（放在 Agent 详情 DebugInfoPanel 旁）。
- **AC**：重启后端后运行记录可查；dashboard 运行统计改读此表。

### 2.2 知识库文档状态机修复

- **问题**：`KnowledgeDocument.status` 恒为 `UPLOADED`，从不写 READY → dashboard 同步数恒 0、无处理进度。
- **改法**：上传流水线各阶段写状态（`PARSING → CHUNKING → EMBEDDING → READY / FAILED( errorMessage )`）；失败可重试（`POST /documents/:id/reprocess`）。
- **AC**：上传后前端能看到状态流转；FAILED 文档可重试转 READY；dashboard `knowledgeSyncedCount` 恢复真实数字。

### 2.3 知识检索事件真实化

- **问题**：`runtime/agent-runtime.ts:67-84` `knowledge.status` 假数据（名称硬编码、召回数 undefined）。
- **改法**：`RuntimeKnowledgeService` 检索完成后回传 `{ kbId, knowledgeName, retrievedCount, scores }`，由 runtime 发真实事件。
- **AC**：前端 KnowledgeStatus 组件显示真实知识库名与召回条数。

### 2.4 上传异步化

- **改法**：`POST /knowledge/bases/:id/documents` 改为"立即返回文档记录（状态 PARSING）+ 队列内异步处理"。MVP 用进程内简单队列（p-queue）即可，不引入 Redis/BullMQ；进程重启后把非终态文档标记 FAILED 支持重试。
- **AC**：上传 50 页级文档不再 HTTP 超时。

### 2.5 遗留链路清理

- `conversation` 模块标 deprecated（路由保留但注释指引 agent-runtime），删除 `apps/backend/src/modules/ai` 死模块、`RuntimeMemoryRepository`、`ToolRunner`。
- `workspace.service.getDashboardSummary` 与 `dashboard.service` 合并为单一实现。

---

## Phase 3 (M3)：功能补齐 — P2（对求职展示价值排序）

### 3.1 知识库多格式解析（PDF/docx/xlsx）

- 引入 `pdf-parse`（或 pdfjs）+ `mammoth`（docx）+ `xlsx`：上传时按 MIME 分流解析为纯文本后走现有切分/embedding 链路；Excel 每行/每表转 markdown 表格文本。
- 同步放开附件解析：聊天附件支持 PDF（后端 `runtime-attachment.service.ts` 去掉 400，抽文本走知识注入路径，上限 30 页）。
- **AC**：上传一份真实 PDF → 检索测试能命中其中内容；聊天里直接提问 PDF 附件内容可回答。

### 3.2 HTTP 自定义插件执行器（打通插件闭环）

- 实现 `http-plugin.executor.ts`：方法/URL/Header/Body 模板（`{{args.x}}` 插值）、超时、SSRF 复用 1.4 的 guard、响应 JSONPath 截取。
- `PluginCredentialService` 落地：工具执行时按绑定 credential 解密注入（复用 `secret.service.ts`），接口：列表（掩码）/创建/更新/删除。
- 前端插件创建表单补 HTTP 配置 UI + 凭据选择。
- **AC**：创建一个调用真实第三方 API 的插件 → 工具测试面板跑通 → Agent 内 function calling 调用成功。

### 3.3 插件市场 v1

- 内置"官方插件目录"（数据源：代码内 JSON 常量），前端插件页加"市场"Tab：浏览/一键安装到 workspace（复用 `ensureBuiltinPlugins` 的播种逻辑，按目录项生成）。
- 不做第三方上传审核（明确写进 scope boundary）。
- **AC**：市场安装的插件出现在插件列表并可绑定 Agent。

### 3.4 工作流节点补全：知识检索节点 + 插件节点

- 新增 `knowledge` 节点执行器（复用 `retrieval.service`，入参 query/topK）与 `plugin` 节点执行器（复用 `plugin-registry` 调用）。
- 前端画布注册两类节点 + 配置面板（前端已有 `plugin`/`database` 占位节点，替换为真实执行）。
- **AC**：工作流中检索知识库 → LLM 节点引用检索结果 → 出参正确。

### 3.5 长期记忆 v1（对话摘要压缩）

- 会话历史超 `contextLimit` 时，对被截断部分做 LLM 摘要，存 `Conversation.summary`，system 注入"历史摘要"段。低成本实现"记忆"卖点。
- **AC**：超长会话中早期关键信息仍能被模型复述。

### 3.6 模型供应商扩展

- `ModelProviderType` 增加 `ANTHROPIC / GEMINI`，ai-gateway 各实现一个 Provider（消息格式与 SSE 解析各自适配）；OpenAI Compatible 路径保持不变。
- `capabilities/contextWindow/maxOutputTokens` 开始参与上下文裁剪（历史截断按 token 估算）。
- **AC**：配置一个 Anthropic（或 Gemini 兼容）Provider 后 Agent 正常流式对话。

### 3.7 发布渠道扩展（选做，按时间）

- iframe embed 正式包：`/embed/agents/:slug` 页面 + 嵌入代码片段复制（后端 embedPath 字段已有，前端补页面即可，性价比最高）。
- Webhook 渠道（出站 POST 对话事件），为后续微信/飞书渠道打基础。

---

## Phase 4 (M4)：前端缺口与体验收尾

| # | 项 | 内容 | AC |
|---|---|---|---|
| 4.1 | workflow-canvas Header 接线 | 发布按钮接 `publish/workflows`、历史接 `versions`、saveStatus 状态传入 | 画布内可完成发布并看到历史 |
| 4.2 | 创建工作区入口 | WorkspaceSwitcher TODO 补弹窗 + `POST /workspaces`（后端已有） | 可创建并切换新工作区 |
| 4.3 | 全局搜索 API + UI | 后端 `GET /search?q=` 聚合 agent/workflow/kb/conversation 标题，前端 GlobalSearch 补全 | 一处搜索全工作区资产 |
| 4.4 | settings 页 | 改造现有占位卡：工作区资料（改名/删除）、成员管理（复用 WorkspaceSettings）、密钥管理入口（credentials API 已有，纯前端接线） | 三张卡片全部真实可用 |
| 4.5 | architecture 页 | 用现有架构图素材做成真实技术架构说明页（或先从菜单摘除该路由） | 不再是空页 |
| 4.6 | 知识流水线页处置 | `knowledge-pipeline` 纯 mock：v1 直接从菜单摘除，等 2.2 状态机做完后用真实状态流重做 | 移除误导性 mock 页 |
| 4.7 | 知识库旧版页面删除 | `knowledge-base/page/` 旧 UI 目录清理 | 构建产物减小、无死代码 |
| 4.8 | 运行历史页 | 配合 2.1：AgentRun 列表 + 详情（事件时间线、token 用量、工具调用链） | 可查任意历史运行 |
| 4.9 | 聊天多模态扩展 | 多附件、音频转写（可选 AudioTranscribe 类 API）| 至少支持多图片 + PDF |

---

## 排期与依赖总览

```
M1 (P0 安全稳定)   ──→  M2 (P1 数据一致)  ──→  M3 (P2 功能补齐)  ──→  M4 (体验收尾)
 1.1 轮次上限          2.1 AgentRun表★        3.1 PDF/docx 解析★       4.1~4.9 按需
 1.2 真取消★           2.2 文档状态机★        3.2 HTTP 插件★
 1.3 code 沙箱         2.3 检索事件真实化     3.3 插件市场
 1.4 SSRF guard        2.4 上传异步化         3.4 工作流节点补全
 1.5 渠道限流          2.5 遗留清理           3.5 长期记忆 / 3.6 多供应商
 1.6 探针/分页                                3.7 渠道扩展(选做)
```

- ★ = 建议优先做的 8 项：2 个 P0 运行时健壮性 + AgentRun + 文档状态机 + PDF 解析 + HTTP 插件 + 画布 Header 接线 + 运行历史页（前后端配对成完整故事线）。
- 依赖关系：3.2 依赖 1.4（SSRF guard）；4.8 依赖 2.1；4.6 依赖 2.2；M3 各项相互独立可并行。

## Scope Boundaries（本期明确不做）

- 不做 Redis/BullMQ 任务队列（进程内队列够用）
- 不做多 Agent 协作运行时（前端占位保留，类型标注 coming soon）
- 不做 rerank / BM25 混合检索（记录到 backlog）
- 不做第三方渠道（微信公众号/飞书/Discord）正式对接，只做 Webhook 出站基础
- 不做配额计费/多租户运营体系

## 测试与验收策略

- M1 全部补单测（runner/ssrf-guard/limiter 三处为重点，现有 vitest/jest 体系内）。
- M2 起每个 feature 附一个 spec；M3 的 3.1/3.2 各补一个端到端集成测试（真实文件/真实 HTTP mock server）。
- 每阶段结束跑一次全量 `pnpm -r test` + 手工冒烟：搭 Agent → 对话 → 发布 → 公开页访问。
