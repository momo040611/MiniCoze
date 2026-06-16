# MiniCoze Backend

MiniCoze Backend 是 MiniCoze 可视化 AI Agent 搭建平台的后端服务，基于 NestJS、TypeScript、Prisma 和 PostgreSQL 构建。

当前后端包含用户认证、工作区、Agent 配置、Agent Runtime、公开 Agent、发布渠道、AI Gateway、模型服务管理、凭证管理、工作流、文件上传和知识库等能力。

## 当前完成度概览

截至 2026-06-16，后端主体能力已经覆盖 Agent 搭建、运行、发布、工作流、插件、文件、知识库和模型服务管理。整体处于“核心链路可用，运营治理能力待补齐”的阶段。

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 基础框架 | 已完成 | 已接入全局 `/api` 前缀、Swagger、CORS、参数校验、响应包装、异常过滤和 Prisma 数据库访问。 |
| 用户与认证 | 基本完成 | 支持注册、登录、JWT 鉴权、用户资料、头像、密码更新。 |
| 工作区与成员 | 基本完成 | 支持工作区 CRUD、成员管理、角色校验、工作区仪表盘聚合。 |
| Agent 配置 | 基本完成 | 支持 Agent CRUD、状态管理、模型字段兼容、工作区模型绑定、知识库/插件/工作流绑定。 |
| Agent Runtime | 基本完成 | 支持流式运行、会话与消息持久化、附件元数据、token usage 写入最新助手消息；运行记录本身仍是内存上下文。 |
| 公开 Agent | 基本完成 | 支持通过发布快照读取公开 Agent、公开聊天流、公开运行入口和公开文件上传。 |
| 发布系统 | 基本完成 | 支持 Agent / Workflow 发布检查、版本、记录、回滚、下线，以及 Web / API 渠道配置和 API Key 轮换。 |
| AI Gateway | 基本完成 | 支持环境变量 Provider 的旧调用方式，以及基于工作区模型解析的动态 OpenAI Compatible 调用。 |
| 凭证管理 | 基本完成 | 支持工作区凭证 CRUD、AES-256-GCM 加密、掩码返回、引用检查和运行时解密。 |
| 模型服务管理 | 基本完成 | 支持 Provider / Model CRUD、连接测试、OpenAI Compatible `/models` 同步、默认模型设置、引用检查。 |
| 工作流 | 基本完成 | 支持工作流 CRUD、草稿、发布版本、同步/流式运行、运行节点记录、取消、运行列表、Agent 绑定和持久化变量。 |
| 插件 | 部分完成 | 支持插件、工具、Agent 绑定、调用记录、内置插件执行；HTTP 插件执行器仍返回 `NOT_IMPLEMENTED`。 |
| 文件服务 | 基本完成 | 支持上传、列表、详情、内容读取、删除，本地存储和 COS 存储配置。 |
| 知识库 | 部分完成 | 支持知识库、文档、切片、Agent 绑定、向量索引、语义检索和重建索引；依赖 pgvector 与 `EMBEDDING_*` 配置。 |
| 运营治理 | 未完成 | 暂无 AgentRun 持久化表、usage 聚合统计、审计日志、额度、计费、预算和超限拦截。 |

## 技术栈

- NestJS 
- TypeScript
- Prisma
- PostgreSQL
- JWT / Passport
- Swagger
- class-validator / class-transformer
- Jest / Supertest

## 全局约定

业务接口统一使用 `/api` 前缀，Swagger 地址为：

```text
http://localhost:3000/api-docs
```

`setup-app.ts` 中启用了：

- CORS
- 全局 `ValidationPipe`
- 全局 `ResponseInterceptor`
- 全局 `HttpExceptionFilter`
- Swagger

普通成功响应会被包装为：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

异常响应会被统一处理为：

```json
{
  "code": 40000,
  "message": "错误信息",
  "data": null
}
```

分页响应优先使用 `PaginatedData<T>`：

```json
{
  "list": [],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

SSE、文件流等不适合统一包装的响应，需要使用 `@SkipResponseWrap()`。

## 环境变量

在仓库根目录或后端运行环境中准备 `.env`。核心变量如下：

| 变量 | 说明 | 默认值/示例 |
| --- | --- | --- |
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | 后端端口 | `3000` |
| `DATABASE_URL` | PostgreSQL 连接地址 | `postgresql://user:password@localhost:5432/minicoze?schema=public` |
| `JWT_SECRET` | JWT 签名密钥 | 必填 |
| `JWT_EXPIRES_IN` | JWT 过期时间 | `2h` |
| `CORS_ORIGIN` | 允许跨域的前端地址，多个地址用英文逗号分隔 | `http://localhost:5173` |
| `REDIS_HOST` | Redis 地址，当前预留配置 | `localhost` |
| `REDIS_PORT` | Redis 端口，当前预留配置 | `6379` |
| `FILE_STORAGE_DRIVER` | 文件存储驱动 | `local` 或 `cos` |
| `FILE_UPLOAD_DIR` | 本地文件存储目录 | `storage/uploads` |
| `FILE_PUBLIC_BASE_URL` | 文件公开访问基础路径 | `/api/files` |
| `FILE_MAX_IMAGE_SIZE` | 图片上传大小限制，单位 byte | `5242880` |
| `FILE_MAX_DOCUMENT_SIZE` | 文档上传大小限制，单位 byte | `52428800` |
| `COS_SECRET_ID` | COS SecretId，`FILE_STORAGE_DRIVER=cos` 时必填 | - |
| `COS_SECRET_KEY` | COS SecretKey，`FILE_STORAGE_DRIVER=cos` 时必填 | - |
| `COS_BUCKET` | COS Bucket，`FILE_STORAGE_DRIVER=cos` 时必填 | - |
| `COS_REGION` | COS Region，`FILE_STORAGE_DRIVER=cos` 时必填 | - |
| `COS_PUBLIC_BASE_URL` | COS 公开访问基础地址 | - |
| `AI_PROVIDER` | 旧环境变量 AI Provider | `openai` 或 `deepseek` |
| `OPENAI_API_KEY` | OpenAI API Key | `sk-xxxx` |
| `OPENAI_BASE_URL` | OpenAI 兼容接口地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | OpenAI 默认模型 | `gpt-4o-mini` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | `sk-xxxx` |
| `DEEPSEEK_BASE_URL` | DeepSeek 兼容接口地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | DeepSeek 默认模型 | `deepseek-v4-flash` |
| `SECRET_ENCRYPTION_KEY` | 工作区凭证加密密钥 | 生产环境必填 |
| `EMBEDDING_BASE_URL` | 知识库向量化服务地址 | OpenAI Compatible embedding 地址 |
| `EMBEDDING_API_KEY` | 知识库向量化服务密钥 | 必填，用于知识库检索 |
| `EMBEDDING_MODEL` | 知识库向量化模型 | 示例：`text-embedding-3-small` |
| `EMBEDDING_DIM` | 向量维度，需与 pgvector 表结构匹配 | 当前 schema 为 `1024` |
| `EMBEDDING_BATCH_SIZE` | 批量向量化条数 | `32` |
| `BING_SEARCH_API_KEY` | 内置 Bing 搜索插件密钥 | 未配置时相关工具不可用 |
| `BING_SEARCH_ENDPOINT` | Bing 搜索接口地址 | `https://api.bing.microsoft.com/v7.0/search` |
| `BING_SEARCH_TIMEOUT_MS` | Bing 搜索超时时间 | `10000` |
| `IMAGE_UNDERSTANDING_API_KEY` | 图片理解插件 API Key | 默认回退 `OPENAI_API_KEY` |
| `IMAGE_UNDERSTANDING_BASE_URL` | 图片理解 OpenAI Compatible 地址 | `https://api.openai.com/v1` |
| `IMAGE_UNDERSTANDING_MODEL` | 图片理解模型 | `gpt-4o-mini` |
| `IMAGE_UNDERSTANDING_TIMEOUT_MS` | 图片理解超时时间 | `20000` |
| `LINK_READER_TIMEOUT_MS` | 链接读取超时时间 | `15000` |
| `LINK_READER_MAX_CHARS` | 链接读取最大字符数 | `20000` |

注意：

- `DATABASE_URL` 和 `JWT_SECRET` 是必填项。
- 生产环境中 `JWT_SECRET` 不能使用弱密钥。
- 生产环境中 `SECRET_ENCRYPTION_KEY` 必须配置；开发环境未配置时，后端会使用稳定 fallback 并输出 warning。
- `FILE_STORAGE_DRIVER=cos` 时必须配置 COS 相关变量。
- 知识库向量检索运行时依赖 `EMBEDDING_*` 变量；当前 `env.validation.ts` 尚未覆盖这些变量，缺失时会在 Embedder 初始化或调用时失败。
- `.env` 不要提交到 Git。

## 数据库

Prisma schema 位于：

```text
apps/backend/prisma/schema.prisma
```

修改数据库结构后执行：

```bash
pnpm --filter backend prisma:migrate
pnpm --filter backend prisma:generate
```

当前与模型服务管理相关的核心表：

- `WorkspaceCredential`：工作区通用凭证，只保存密文 `secretEncrypted` 和掩码 `maskedHint`。
- `WorkspaceModelProvider`：工作区模型服务，保存 `providerType`、`baseUrl`、`credentialId` 和连接测试状态。
- `WorkspaceModel`：工作区可用模型，保存真实 `modelId`、展示名、能力描述、上下文窗口和启用状态。
- `WorkspaceRuntimeSetting`：工作区运行默认设置，当前主要使用 `defaultModelId`。
- `Agent.workspaceModelId`：Agent 可选绑定的工作区模型；旧字段 `Agent.model` 保留用于兼容。

关系如下：

```text
WorkspaceCredential
→ WorkspaceModelProvider
→ WorkspaceModel
→ Agent.workspaceModelId / WorkspaceRuntimeSetting.defaultModelId
```

## 凭证管理

凭证模块位于：

```text
apps/backend/src/modules/credentials
```

接口：

```text
GET    /api/workspaces/:workspaceId/credentials
POST   /api/workspaces/:workspaceId/credentials
PATCH  /api/workspaces/:workspaceId/credentials/:credentialId
DELETE /api/workspaces/:workspaceId/credentials/:credentialId
GET    /api/workspaces/:workspaceId/credentials/:credentialId/references
```

创建凭证示例：

```json
{
  "name": "DeepSeek Key",
  "type": "BEARER_TOKEN",
  "secret": "sk-xxxx",
  "config": {}
}
```

凭证规则：

- `OWNER` / `ADMIN` 可以创建、更新和删除凭证。
- 工作区成员可以查看凭证元信息。
- 接口只返回 `maskedHint`，不返回明文 `secret`，也不返回密文 `secretEncrypted`。
- 更新凭证时不传 `secret` 表示保留旧密钥。
- 凭证被模型 Provider 引用时拒绝删除。
- 运行时调用模型前才会通过 `CredentialService.getRuntimeCredential()` 解密凭证。

支持的凭证类型：

- `BEARER_TOKEN`
- `API_KEY_HEADER`
- `BASIC_AUTH`

## 模型服务管理

模型服务管理模块位于：

```text
apps/backend/src/modules/model-management
```

### Provider 接口

```text
GET    /api/workspaces/:workspaceId/model-providers
POST   /api/workspaces/:workspaceId/model-providers
GET    /api/workspaces/:workspaceId/model-providers/:providerId
PATCH  /api/workspaces/:workspaceId/model-providers/:providerId
DELETE /api/workspaces/:workspaceId/model-providers/:providerId
POST   /api/workspaces/:workspaceId/model-providers/:providerId/test
POST   /api/workspaces/:workspaceId/model-providers/:providerId/sync-models
```

创建 Provider 示例：

```json
{
  "name": "DeepSeek 官方服务",
  "providerType": "DEEPSEEK",
  "baseUrl": "https://api.deepseek.com",
  "credentialId": "credential-id",
  "enabled": true
}
```

Provider 保存的是模型服务配置，不保存密钥明文：

```text
providerType + baseUrl + credentialId
```

Base URL 规则：

- 允许 `http://` 和 `https://`。
- 允许域名、IPv4、IPv6 和端口。
- 禁止 username、password、query 和 hash。
- 保存前会移除末尾 `/`。
- 后续调用接口时使用 `new URL()` 拼接路径，不做字符串拼接。

### 模型接口

```text
GET    /api/workspaces/:workspaceId/models
POST   /api/workspaces/:workspaceId/models
GET    /api/workspaces/:workspaceId/models/:modelId
PATCH  /api/workspaces/:workspaceId/models/:modelId
DELETE /api/workspaces/:workspaceId/models/:modelId
POST   /api/workspaces/:workspaceId/models/:modelId/set-default
GET    /api/workspaces/:workspaceId/models/:modelId/references
```

手动创建模型示例：

```json
{
  "providerId": "provider-id",
  "modelId": "deepseek-chat",
  "displayName": "DeepSeek Chat",
  "enabled": true,
  "capabilities": {
    "chat": true,
    "image": false
  },
  "contextWindow": 128000,
  "maxOutputTokens": 4096
}
```

模型规则：

- 模型必须属于当前工作区的 Provider。
- 同一个 Provider 下 `modelId` 唯一。
- 设置默认模型时只更新 `WorkspaceRuntimeSetting.defaultModelId`。
- 删除模型前会检查 Agent 引用和工作区默认模型引用。

### 同步服务商模型

同步模型接口：

```text
POST /api/workspaces/:workspaceId/model-providers/:providerId/sync-models
```

当前同步逻辑基于 OpenAI Compatible 协议：

```text
GET {baseUrl}/models
```

期望响应：

```json
{
  "data": [
    { "id": "deepseek-chat" },
    { "id": "deepseek-reasoner" }
  ]
}
```

后端会读取 `data[].id`，并 upsert 到 `WorkspaceModel`。

如果服务商不支持 `GET /models`，可以使用手动创建模型接口。

## AI Gateway 与模型运行时

AI Gateway 位于：

```text
apps/backend/src/modules/ai-gateway
```

旧方法仍然保留，并继续使用环境变量 Provider：

- `generate()`
- `generateStream()`
- `chatStream()`

新增动态模型方法：

- `generateWithResolvedModel()`
- `generateStreamWithResolvedModel()`
- `chatStreamWithResolvedModel()`

动态模型调用流程：

```text
ResolvedModel
→ DynamicAiProviderFactory
→ OpenAiProvider / DeepSeekProvider
→ POST {baseUrl}/chat/completions
```

当前第一阶段中，`OPENAI`、`DEEPSEEK`、`OPENAI_COMPATIBLE` 都复用 OpenAI Compatible 协议。

## Agent 模型选择流程

Agent 仍保留旧字段：

```text
model: string
```

新增字段：

```text
workspaceModelId?: string
```

创建 Agent 时：

```text
如果请求传 workspaceModelId：
  校验模型属于当前工作区且启用，然后保存 Agent.workspaceModelId

如果请求未传 workspaceModelId：
  尝试读取 WorkspaceRuntimeSetting.defaultModelId
  有默认模型则保存到 Agent.workspaceModelId
  没有默认模型则继续使用旧 model 字符串
```

运行 Agent 时模型解析优先级：

```text
RunAgentDto.workspaceModelId
→ Agent.workspaceModelId
→ WorkspaceRuntimeSetting.defaultModelId
→ RunAgentDto.model / Agent.model
→ 环境变量默认模型
```

解析到数据库模型时：

```text
WorkspaceModel
→ WorkspaceModelProvider
→ WorkspaceCredential
→ 解密 secret
→ 动态 AI Gateway 调用
```

数据库模型不可用但旧 `model` 字符串存在时，会回退旧环境变量 Provider。

## Agent Runtime

流式运行接口：

```text
POST /api/agent-runs/stream
```

最小请求体：

```json
{
  "agentId": "agent-id",
  "message": "你好"
}
```

可选指定模型：

```json
{
  "agentId": "agent-id",
  "message": "你好",
  "workspaceModelId": "workspace-model-id"
}
```

常见 SSE 事件顺序：

```text
run.created
run.in_progress
message.delta
message.completed
run.completed
stream.done
```

当前 Runtime 会持久化：

- `Conversation`
- `Message`
- `Message.tokenUsage`

当前 Runtime 不持久化：

- `AgentRun`
- usage 聚合统计
- audit 审计日志

`RuntimePrismaRepository.runs` 是内存中的运行上下文 Map，只在一次流式运行期间保存 `RuntimeContext`，运行完成、失败或取消后删除。

## 发布快照兼容

Agent 发布快照保存在：

```text
AgentVersion.snapshot
```

新快照会同时保存：

```text
model
workspaceModelId
```

旧快照没有 `workspaceModelId` 也能继续解析和运行。公开 Agent 运行会优先使用快照中的 `workspaceModelId`，缺失时回退旧 `model` 字符串。

## Workflow LLM 节点

工作流 LLM 节点当前保持兼容策略：

```text
如果节点配置中有 workspaceModelId：
  使用 ModelResolverService 解析数据库模型

如果节点配置中没有 workspaceModelId：
  继续使用旧 model 字符串 + 环境变量 Provider
```

这样现有工作流不会因为模型服务管理改造被强制迁移。

## Public Agent

公开 Agent 运行使用发布快照：

```text
GET  /api/public/agents/:slug
POST /api/public/agents/:slug/chat/stream
POST /api/public/agent-runs/stream
```

公开运行会读取 `AgentVersion.snapshot`，因此：

- 新发布快照可以使用 `workspaceModelId`。
- 旧发布快照继续使用 `model` 字符串。
- 凭证不会写入快照，运行时仍读取最新有效凭证。

## 开发与验证

启动开发服务：

```bash
pnpm --filter backend start:dev
```

Windows PowerShell 可以使用：

```powershell
pnpm.cmd --filter backend start:dev
```

常用验证命令：

```bash
pnpm --filter backend prisma:generate
pnpm --filter backend build
pnpm --filter backend test
pnpm --filter backend test:e2e
```

Windows PowerShell：

```powershell
pnpm.cmd --filter backend prisma:generate
pnpm.cmd --filter backend build
pnpm.cmd --filter backend test
pnpm.cmd --filter backend test:e2e
```

## 当前未实现

以下能力当前未在后端实现：

- 前端设置页面。
- AgentRun 持久化运行记录。
- usage 聚合统计。
- audit 审计日志。
- 插件运行策略和 HTTP 插件执行器。
- 当前只支持 OpenAI Compatible `/models`。

## 开发约定

- 新业务优先放到 `src/modules/<module-name>`。
- Controller 只负责路由、参数接收和调用 Service。
- 业务逻辑放在 Service。
- HTTP 入参使用 DTO，并通过 `class-validator` 描述校验规则。
- 数据库访问统一通过 `PrismaService`。
- 通用错误、分页、响应、鉴权和用户上下文优先复用 `src/common`。
- 普通成功响应不要在 Controller 中手动包装 `{ code, message, data }`。
- 业务异常优先使用 `BusinessException`。
- 文件下载、SSE、AI 流式响应等特殊响应使用 `@SkipResponseWrap()`。
- 修改 Prisma schema 后必须生成 migration，并执行 `prisma:generate`。
