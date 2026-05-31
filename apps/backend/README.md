# MiniCoze Backend

MiniCoze Backend 是 MiniCoze 可视化 AI Agent 搭建平台的后端服务，基于 NestJS、TypeScript、Prisma 和 PostgreSQL 构建。

当前后端已包含用户认证、当前用户资料、工作空间、Agent 配置、普通会话、Agent Runtime 流式运行、AI Gateway、工作流运行、文件上传等能力；`knowledge`、`publish` 目前仍是模块占位或待完善能力。

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
| `REDIS_HOST` | Redis 地址，预留配置 | `localhost` |
| `REDIS_PORT` | Redis 端口，预留配置 | `6379` |
| `CORS_ORIGIN` | 允许跨域的前端地址，多个地址用英文逗号分隔 | `http://localhost:5173` |
| `FILE_UPLOAD_DIR` | 本地文件存储目录 | `storage/uploads` |
| `FILE_PUBLIC_BASE_URL` | 文件公开访问基础路径 | `/api/files` |
| `FILE_MAX_IMAGE_SIZE` | 图片最大上传大小，字节 | `5242880` |
| `FILE_MAX_DOCUMENT_SIZE` | 文档最大上传大小，字节 | `52428800` |
| `AI_PROVIDER` | AI 供应商 | `openai` 或 `deepseek` |
| `OPENAI_API_KEY` | OpenAI API Key | `sk-xxxx` |
| `OPENAI_BASE_URL` | OpenAI 兼容接口地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | OpenAI 默认模型 | `gpt-4o-mini` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | `sk-xxxx` |
| `DEEPSEEK_BASE_URL` | DeepSeek 兼容接口地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | DeepSeek 默认模型 | `deepseek-v4-flash` |

注意：

- `DATABASE_URL` 和 `JWT_SECRET` 是必填项。
- 生产环境中 `JWT_SECRET` 不能使用 `replace-me`，长度不能小于 32。
- `.env` 不要提交到 Git。

## 数据库

Prisma schema 位于：

```text
apps/backend/prisma/schema.prisma
```

当前核心模型：

- `User`：用户账号、密码哈希、头像、状态和资源归属。
- `Workspace`：工作空间，是 Agent、Workflow、File 等资源的归属边界。
- `WorkspaceMember`：用户与工作空间的成员关系，角色包含 `OWNER`、`ADMIN`、`MEMBER`。
- `Agent`：单 Agent 配置，包含提示词、模型、温度、开场白、上下文条数和状态。
- `Conversation` / `Message`：会话和消息，保存用户输入、助手回复、模型信息、token 使用和错误信息。
- `FileAsset`：上传文件元数据，包含用途、可见性、状态、存储 key、URL、MIME 类型和大小。
- `Workflow` / `WorkflowVersion`：工作流草稿、当前版本和发布版本。
- `WorkflowRun` / `WorkflowRunNode`：工作流运行记录和节点执行记录。

修改数据库结构时的流程：

```bash
pnpm --filter backend prisma:migrate
pnpm --filter backend prisma:generate
```

## 模块与接口

### Health

```text
GET /api/health
```

返回服务状态和当前时间。

### Auth

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/profile
```

注册时使用 bcrypt 保存密码哈希。登录成功后返回 Bearer Token。受保护接口使用：

```text
Authorization: Bearer <token>
```

### User

```text
GET   /api/users/me
PATCH /api/users/me
```

用于查询和更新当前登录用户信息。

### Workspace

```text
POST   /api/workspaces
GET    /api/workspaces
GET    /api/workspaces/:workspaceId
PATCH  /api/workspaces/:workspaceId
DELETE /api/workspaces/:workspaceId
```

权限规则：

- 创建工作空间后，当前用户自动成为 `OWNER`。
- 工作空间成员可以查看工作空间。
- `OWNER` 和 `ADMIN` 可以更新工作空间。
- 只有 `OWNER` 可以删除工作空间。

权限判断集中在 `WorkspaceAccessService`：

- `ensureMember`
- `ensureCanManage`
- `ensureOwner`

### Agent 配置

```text
POST   /api/agents
GET    /api/agents?workspaceId=...
GET    /api/agents/:agentId
PATCH  /api/agents/:agentId
DELETE /api/agents/:agentId
```

常用创建字段：

```json
{
  "workspaceId": "workspace-id",
  "name": "客服助手",
  "description": "用于回答产品和售后问题",
  "avatarUrl": "https://example.com/avatar.png",
  "systemPrompt": "你是一个专业、耐心的客服助手。",
  "model": "deepseek-v4-flash",
  "temperature": 0.7,
  "openingMessage": "你好，我可以帮你解答产品和售后问题。",
  "contextLimit": 20,
  "status": "DRAFT"
}
```

说明：

- 创建、更新、删除 Agent 需要工作空间管理权限。
- 查询 Agent 列表和详情需要当前用户是工作空间成员。
- `openingMessage` 仅用于前端展示，不作为系统提示词发送给模型。
- `contextLimit` 表示模型调用时最多携带的历史消息条数，不包含当前用户输入。

### Conversation 普通对话

```text
POST   /api/workspaces/:workspaceId/conversations
GET    /api/workspaces/:workspaceId/conversations/:conversationId
POST   /api/workspaces/:workspaceId/conversations/:conversationId/messages
GET    /api/workspaces/:workspaceId/conversations/agents/:agentId
DELETE /api/workspaces/:workspaceId/conversations/:conversationId
```

普通对话链路：

```text
校验工作空间权限
创建或读取 Conversation
保存用户 Message
读取 Agent systemPrompt/model/temperature/contextLimit
调用 AI Gateway
保存 assistant Message
返回完整回复
```

### Agent Runtime 流式运行

```text
POST /api/agent-runs/stream
```

该接口需要 Bearer Token，并以 SSE 返回事件。最小请求体：

```json
{
  "agentId": "agent-id",
  "message": "你好"
}
```

常见事件顺序：

```text
run.created
run.in_progress
message.delta
message.completed
run.completed
stream.done
```

失败时会返回：

```text
run.failed
stream.done
```

### Workflow

```text
POST /api/workflows
GET  /api/workflows?workspaceId=...
GET  /api/workflows/:workflowId
PATCH /api/workflows/:workflowId
PUT  /api/workflows/:workflowId/draft
POST /api/workflows/:workflowId/validate
POST /api/workflows/:workflowId/publish
GET  /api/workflows/:workflowId/versions
POST /api/workflows/:workflowId/run
GET  /api/workflows/:workflowId/runs
GET  /api/workflows/runs/:runId
```

工作流当前支持：

- 保存草稿定义到 `draftDefinition`。
- 校验节点和边的基础合法性。
- 发布工作流版本，生成 `WorkflowVersion`。
- 运行已发布版本，记录 `WorkflowRun` 和 `WorkflowRunNode`。
- 支持 start、llm、end 等节点执行基础链路。

状态说明：

- `WorkflowStatus`：`DRAFT`、`ACTIVE`、`ARCHIVED`
- `WorkflowRunStatus`：`PENDING`、`RUNNING`、`SUCCEEDED`、`FAILED`、`CANCELED`
- `WorkflowRunNodeStatus`：`PENDING`、`RUNNING`、`SUCCEEDED`、`FAILED`、`SKIPPED`

### File

```text
POST   /api/files/upload
GET    /api/files/:fileId/content
DELETE /api/files/:fileId
```

文件上传使用 `multipart/form-data`，字段：

- `file`：上传文件。
- `purpose`：文件用途，取值来自 `FilePurpose`，包括 `AVATAR`、`KNOWLEDGE_DOCUMENT`、`CHAT_ATTACHMENT`。
- `workspaceId`：可选，绑定工作空间文件时使用。

文件读取和删除会校验当前用户权限。公开文件可直接访问；私有文件需要所有者或工作空间成员权限。

### AI Gateway

```text
GET /api/ai-gateway/providers
```

AI Gateway 负责屏蔽不同模型供应商的调用差异。当前支持 OpenAI 兼容接口和 DeepSeek，核心 service 位于：

```text
src/modules/ai-gateway/ai-gateway.service.ts
```

主要能力：

- `generate()`：非流式生成。
- `generateStream()`：provider 原始流式输出。
- `chatStream()`：供 Agent Runtime / Runner 使用的流式适配接口。

### 占位模块

以下模块当前主要是占位或待继续完善：

- `knowledge`
- `publish`

## 启动

在仓库根目录执行：

```bash
pnpm --filter backend start:dev
```

Windows PowerShell 如果 `pnpm` 被执行策略拦截，可以使用：

```powershell
pnpm.cmd --filter backend start:dev
```

默认地址：

```text
http://localhost:3000/api/health
http://localhost:3000/api-docs
```

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
- 修改 Prisma schema 后必须生成 migration 并执行 `prisma:generate`。
