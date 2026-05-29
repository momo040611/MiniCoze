# MiniCoze 知识库 API 文档

## 1. 模块说明

知识库模块覆盖 RAG 数据生产、文档处理、分段管理、检索调试、元数据管理、生产流水线配置和处理流水线执行状态。当前前端使用 `apps/web/src/api/knowledge-base/mock.ts` 与 `apps/web/src/api/knowledge-pipeline/mock.ts` 基于 `localStorage` 模拟后端。

核心页面：

- 知识库列表：搜索、类型/状态/标签筛选、统计、创建、编辑、删除、进入详情、上传入口。
- 知识库详情：文档管理、分段管理、检索测试、元数据、处理流水线、设置。
- 生产流水线：未转换引导页、可视化节点配置、保存草稿、发布、运行测试。
- 处理流水线 Tab：展示当前知识库最新运行记录、步骤状态、进度、日志、失败重试。

## 2. 数据模型

```ts
type ApiResponse<T> = { code: number; message: string; data: T };
type PageResult<T> = { list: T[]; total: number; page: number; pageSize: number };

type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'indexing' | 'disabled' | 'failed';
  sourceType: 'local_file' | 'text' | 'url' | 'notion' | 'api_source';
  documentCount: number;
  chunkCount: number;
  vectorCount?: number;
  indexStatus?: 'not_started' | 'indexing' | 'ready' | 'failed';
  tags?: string[];
  updatedAt: string;
};

type KnowledgeDocument = {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'uploading' | 'parsing' | 'completed' | 'failed' | 'canceled';
  chunkCount: number;
  parseConfig?: ParseConfig;
  uploadProgress?: number;
  errorMessage?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ParseConfig = {
  ocrEnabled: boolean;
  preserveTable: boolean;
  extractImageCaption: boolean;
  chunkMode: 'general' | 'parent_child' | 'qa';
  chunkSize: number;
  chunkOverlap: number;
  autoVectorize: boolean;
};

type UploadDocumentTask = {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'queued' | 'uploading' | 'parsing' | 'completed' | 'failed' | 'canceled';
  progress: number;
  parseConfig: ParseConfig;
  documentId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeChunk = {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  tokenCount: number;
  characterCount: number;
  embeddingStatus?: 'pending' | 'embedded' | 'failed';
  hitCount?: number;
  metadata: Record<string, string | number | boolean>;
  enabled: boolean;
};

type MetadataField = {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'select';
  description: string;
  required?: boolean;
  filterable?: boolean;
  displayInResult?: boolean;
  tags?: string[];
  enabled: boolean;
};

type RetrievalResult = {
  rank: number;
  score: number;
  documentName: string;
  chunkContent: string;
  metadata: Record<string, string | number | boolean>;
  tokenCount?: number;
  vectorDistance?: number;
  rerankScore?: number;
  matchedBy?: Array<'vector' | 'full_text' | 'rerank' | 'metadata'>;
};

type KnowledgePipeline = {
  id: string;
  knowledgeBaseId: string;
  name: string;
  status: 'draft' | 'published' | 'disabled';
  version: number;
  steps: PipelineStep[];
};

type PipelineRun = {
  id: string;
  knowledgeBaseId: string;
  pipelineName: string;
  pipelineVersion: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  progress: number;
  steps: PipelineRunStep[];
  logs: PipelineLog[];
};
```

## 3. 接口清单

| 能力 | 方法 | 路径 | 使用页面 | 触发时机 | 必须 | Mock | 优先级 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 获取知识库列表 | GET | `/api/knowledge-bases` | 列表、上传弹窗、流水线 | 页面加载/筛选 | 是 | `getKnowledgeBases` | P0 |
| 创建知识库 | POST | `/api/knowledge-bases` | 新建页 | 提交创建 | 是 | `createKnowledgeBase` | P0 |
| 获取知识库详情 | GET | `/api/knowledge-bases/:id` | 详情页 | 页面加载 | 是 | `getKnowledgeBaseById` | P0 |
| 更新知识库 | PUT | `/api/knowledge-bases/:id` | 列表编辑、设置 | 保存配置 | 是 | `updateKnowledgeBase` | P0 |
| 删除知识库 | DELETE | `/api/knowledge-bases/:id` | 列表、设置 | 删除确认 | 是 | `deleteKnowledgeBase` | P0 |
| 修改知识库状态 | PUT | `/api/knowledge-bases/:id/status` | 列表、设置 | 启停 | 是 | `updateKnowledgeBase` | P1 |
| 获取标签列表 | GET | `/api/knowledge-bases/tags` | 列表筛选 | 页面加载 | 否 | 前端从列表聚合 | P2 |
| 上传文档 | POST | `/api/knowledge-bases/:id/documents` | 上传弹窗、文档管理 | 选择/拖拽文件 | 是 | `uploadDocument` | P0 |
| 获取上传任务 | GET | `/api/knowledge-bases/:id/upload-tasks` | 上传弹窗 | 查看队列 | 是 | `getUploadTasks` | P0 |
| 获取上传进度 | GET | `/api/upload-tasks/:taskId/progress` | 上传弹窗 | 轮询进度 | 是 | 前端计时模拟 | P0 |
| 取消上传 | POST | `/api/upload-tasks/:taskId/cancel` | 上传弹窗 | 点击取消 | 是 | `cancelUpload` | P0 |
| 重试上传/解析 | POST | `/api/documents/:documentId/retry` | 文档管理 | 点击重试 | 是 | `retryDocument` | P0 |
| 获取文档列表 | GET | `/api/knowledge-bases/:id/documents` | 文档管理 | Tab 加载/筛选 | 是 | `getDocuments` | P0 |
| 获取文档详情 | GET | `/api/documents/:documentId` | 文档管理 | 查看解析结果 | 否 | 未实现 | P1 |
| 删除文档 | DELETE | `/api/documents/:documentId` | 文档管理 | 删除确认 | 是 | `deleteDocument` | P0 |
| 重新解析文档 | POST | `/api/documents/:documentId/reparse` | 文档管理 | 点击重新解析 | 是 | `reparseDocument` | P0 |
| 批量删除文档 | POST | `/api/documents/batch-delete` | 文档管理 | 批量删除 | 否 | 前端循环 mock | P1 |
| 批量重试失败文档 | POST | `/api/documents/batch-retry` | 文档管理 | 批量重试 | 否 | 前端循环 mock | P1 |
| 批量重新解析 | POST | `/api/documents/batch-reparse` | 文档管理 | 批量解析 | 否 | 前端循环 mock | P1 |
| 获取分段列表 | GET | `/api/knowledge-bases/:id/chunks` | 分段管理 | Tab 加载/筛选 | 是 | `getChunks` | P0 |
| 获取分段详情 | GET | `/api/chunks/:chunkId` | 分段管理 | 查看详情 | 否 | 未实现 | P1 |
| 编辑分段 | PUT | `/api/chunks/:chunkId` | 分段管理 | 保存编辑 | 是 | `updateChunk` | P0 |
| 删除分段 | DELETE | `/api/chunks/:chunkId` | 分段管理 | 删除确认 | 是 | `deleteChunk` | P0 |
| 启用/禁用分段 | PUT | `/api/chunks/:chunkId/status` | 分段管理 | Switch 切换 | 是 | `updateChunkStatus` | P0 |
| 搜索分段 | GET | `/api/knowledge-bases/:id/chunks/search` | 分段管理 | 搜索输入 | 否 | 前端过滤 | P1 |
| 执行检索测试 | POST | `/api/knowledge-bases/:id/retrieval-tests` | 检索测试 | 点击开始测试 | 是 | `testRetrieval` | P0 |
| 获取检索历史 | GET | `/api/knowledge-bases/:id/retrieval-tests` | 检索测试 | 加载历史 | 是 | `getRetrievalTests` | P0 |
| 获取检索详情 | GET | `/api/retrieval-tests/:testId` | 检索测试 | 查看历史详情 | 否 | history.results | P1 |
| 获取元数据字段 | GET | `/api/knowledge-bases/:id/metadata-fields` | 元数据 | Tab 加载 | 是 | `getMetadataFields` | P0 |
| 新增元数据字段 | POST | `/api/knowledge-bases/:id/metadata-fields` | 元数据 | 新增字段 | 是 | `createMetadataField` | P0 |
| 更新元数据字段 | PUT | `/api/metadata-fields/:fieldId` | 元数据 | 保存/启停 | 是 | `updateMetadataField` | P0 |
| 删除元数据字段 | DELETE | `/api/metadata-fields/:fieldId` | 元数据 | 删除确认 | 是 | `deleteMetadataField` | P1 |
| 获取流水线配置 | GET | `/api/knowledge-bases/:id/pipeline` | 生产流水线 | 页面加载 | 是 | `getPipeline` | P0 |
| 转换流水线 | POST | `/api/knowledge-bases/:id/pipeline/convert` | 生产流水线 | 点击转换 | 是 | `convertPipeline` | P0 |
| 保存流水线草稿 | PUT | `/api/pipelines/:pipelineId/draft` | 生产流水线 | 保存草稿 | 是 | `savePipeline` | P0 |
| 发布流水线 | POST | `/api/pipelines/:pipelineId/publish` | 生产流水线 | 点击发布 | 是 | `publishPipeline` | P0 |
| 运行流水线测试 | POST | `/api/pipelines/:pipelineId/test-runs` | 生产流水线 | 运行测试 | 是 | `runPipeline` | P0 |
| 创建运行记录 | POST | `/api/pipelines/:pipelineId/runs` | 上传、发布、运行 | 开始处理 | 是 | `runPipeline` | P0 |
| 获取最新运行详情 | GET | `/api/knowledge-bases/:id/pipeline-runs/latest` | 处理流水线 Tab | Tab 加载 | 是 | `getLatestRun` | P0 |
| 刷新运行状态 | POST | `/api/pipeline-runs/:runId/refresh` | 处理流水线 Tab | 点击刷新 | 是 | `refreshLatestRun` | P0 |
| 重试失败步骤 | POST | `/api/pipeline-runs/:runId/steps/:stepId/retry` | 处理流水线 Tab | 点击重试 | 是 | `retryRunStep` | P0 |
| 取消运行 | POST | `/api/pipeline-runs/:runId/cancel` | 处理流水线 Tab | 点击取消 | 否 | 未实现 | P1 |
| 提交 Embedding 任务 | POST | `/api/knowledge-bases/:id/embedding-jobs` | 文档/流水线 | 向量化步骤 | 是 | pipeline run mock | P0 |
| 获取 Embedding 状态 | GET | `/api/embedding-jobs/:jobId` | 分段/流水线 | 状态刷新 | 是 | `chunk.embeddingStatus` | P0 |
| 重新向量化 | POST | `/api/knowledge-bases/:id/re-embed` | 设置/流水线 | 重建索引 | 否 | 未实现 | P1 |
| 删除向量索引 | DELETE | `/api/knowledge-bases/:id/vector-index` | 设置 | 清理索引 | 否 | 未实现 | P2 |

## 4. 请求示例

### 上传文档

```http
POST /api/knowledge-bases/kb-product/documents
Content-Type: multipart/form-data
```

```json
{
  "file": "<binary>",
  "parseConfig": {
    "ocrEnabled": true,
    "preserveTable": true,
    "extractImageCaption": false,
    "chunkMode": "general",
    "chunkSize": 800,
    "chunkOverlap": 100,
    "autoVectorize": true
  }
}
```

```json
{
  "code": 0,
  "message": "uploaded",
  "data": {
    "id": "doc-001",
    "status": "parsing",
    "uploadProgress": 100,
    "chunkCount": 0
  }
}
```

### 执行检索测试

```http
POST /api/knowledge-bases/kb-product/retrieval-tests
```

```json
{
  "query": "如何配置知识库检索？",
  "retrievalMode": "hybrid",
  "topK": 5,
  "scoreThreshold": 0.35,
  "rerankEnabled": true,
  "metadataFilter": { "category": "product" }
}
```

```json
{
  "code": 0,
  "data": [
    {
      "rank": 1,
      "score": 0.86,
      "documentName": "产品手册.pdf",
      "chunkContent": "召回片段内容",
      "matchedBy": ["vector", "full_text", "rerank"],
      "metadata": { "category": "product" }
    }
  ]
}
```

### 刷新处理流水线

```http
POST /api/pipeline-runs/prun-001/refresh
```

```json
{
  "code": 0,
  "data": {
    "id": "prun-001",
    "status": "running",
    "progress": 64,
    "steps": [
      { "stepId": "file-upload", "status": "success" },
      { "stepId": "document-parser", "status": "running" }
    ]
  }
}
```

## 5. Mock 对应关系

- `src/api/knowledge-base/mock.ts`：知识库、文档、上传任务、分段、检索测试、检索历史、元数据。
- `src/api/knowledge-pipeline/mock.ts`：生产流水线配置、转换、保存、发布、运行、刷新、重试。
- 当前上传进度由前端上传弹窗计时模拟；真实后端需要返回任务 ID 并支持轮询、SSE 或 WebSocket。

## 6. 联调建议

1. P0 优先打通知识库、文档上传、上传任务、PipelineRun、检索测试闭环。
2. 文档解析、Embedding、向量入库应设计为异步任务，前端通过 PipelineRun 轮询或 SSE/WebSocket 同步状态。
3. 批量删除、批量重试、批量重新解析建议后端提供批量接口，避免前端循环请求导致状态不一致。
4. 检索测试建议返回 score、vectorDistance、rerankScore、matchedBy、metadata，便于前端展示调试信息。
5. `PipelineRunStep.status` 必须稳定返回 `pending/running/success/failed/skipped`。
