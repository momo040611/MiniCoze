// 统一导出 HTTP 基础能力，页面和业务模块可以从 '@/api' 直接拿到 http、request、ApiError 等。
export * from './http';

// 统一导出“架构设计与技术选型”模块 API，具体接口由该模块在 ./architecture 中维护。
export * from './architecture';

// 统一导出“智能体配置页面”模块 API，避免页面层直接关心接口文件位置。
export * from './agent-config';

// 统一导出“工作流画布界面”模块 API，后续画布节点、连线、运行调试等接口放在该模块下。
export * from './workflow-canvas';
export {
  DEFAULT_WORKFLOW_CANVAS_DATA,
  createWorkflow,
  createWorkflowRemote,
  deleteWorkflow,
  fromWorkflowResponse,
  getWorkflowById,
  getWorkflowByIdRemote,
  getWorkflowDetail,
  getWorkflowList,
  getWorkflowListRemote,
  runWorkflowRemote,
  runWorkflowStreamRemote,
  saveWorkflowDraft,
  saveWorkflowDraftRemote,
  toCreateWorkflowRequest,
  toRunnableWorkflowDefinition,
  toWorkflowDefinition,
  updateWorkflow,
  updateWorkflowRemote,
  type CreateWorkflowParams,
  type CreateWorkflowRequest,
  type PaginatedWorkflowResponse,
  type RunWorkflowRequest,
  type UpdateWorkflowRequest,
  type Workflow,
  type WorkflowCanvasData,
  type WorkflowDefinition,
  type WorkflowResponseLike,
  type WorkflowRunNode,
  type WorkflowRunNodeStatus,
  type WorkflowRunResult,
  type WorkflowRunStatus,
  type WorkflowStreamEvent,
} from './workflows';

// 统一导出"创建知识库界面"模块 API，后续文件上传、解析、知识库管理等接口放在该模块下。
export * from './knowledge-base';
// 统一导出"登录注册"模块 API，包含登录、注册、获取个人信息、退出登录等接口。
export * from './auth';
// 统一导出"首页界面"模块 API。
export * from './homepage';
// 统一导出"工作空间"模块 API。
export * from './workspace';
// 统一导出"工作台 Dashboard"模块 API。
export * from './dashboard';
// 统一导出"Agent 运行时"模块 API（SSE 流式对话）。
export * from './agent-runtime';
export * from './plugins';
