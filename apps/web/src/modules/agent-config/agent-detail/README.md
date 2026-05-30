# agent-detail

types.ts 所有接口和类型定义&#x20;

utils.ts JSON 解析/序列化 + 默认配置工厂

&#x20;constants.ts MODE\_CONFIG 静态配置和工具函数

&#x20;useOrchestrationConfig.ts 编排字符串 → 四个配置对象（planner/flow/multi/opening）及变更处理器

&#x20;useAgentSave.ts 手动保存/自动保存逻辑、并发守卫、定时器管理&#x20;

AgentDetailNavbar.tsx 顶栏 UI（返回、头像ModeSelector、草稿/保存/发布）

&#x20;AgentDetailContent.tsx 按 mode 分发到 Planner/Flow/Multi 子组件&#x20;

AgentDetail.tsx 页面组装：组装 hooks + 子组件 + EditAgentModal

index.ts 统一 re-export，外部 import 路径不变
