export type AgentMode = 'chat' | 'single' | 'multi';

export interface AgentDetailData {
  id: string;
  name: string;
  avatar: string;
  description: string;
  mode: AgentMode;
  persona: string;
  orchestration: string;
  model: string;
  temperature: number;
  openingMessage: string;
  contextLimit: number;
  status: string;
  publishedAt?: string;
}

export interface PlannerConfig {
  selectedModel: string;
  knowledgeEnabled: boolean;
  autoInvoke: boolean;
  plugins: string[];
  workflows: string[];
  fileBoxEnabled: boolean;
  longMemoryEnabled: boolean;
  variables: string[];
  databases: string[];
}

export interface FlowConfig {
  nodes: Array<{ id: string; type: string; x: number; y: number }>;
  workflows: string[];
  variables: string[];
  databases: string[];
}

export type MultiNodeType = 'start' | 'agent' | 'subAgent';

/** 画布节点：坐标与节点自身的配置随图一起持久化，尺寸由渲染层决定 */
export interface MultiGraphNode {
  id: string;
  type: MultiNodeType;
  x: number;
  y: number;
  label: string;
  subtitle?: string;
  avatar?: string;
  modelName?: string;
  skills?: string[];
  useCase?: string;
  prompt?: string;
  suggestions?: string[];
  hasUserCustomPrompt?: boolean;
}

/** 有向连线：主 Agent 向子 Agent 分发任务 */
export interface MultiGraphEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface MultiGraph {
  nodes: MultiGraphNode[];
  edges: MultiGraphEdge[];
}

export interface MultiConfig {
  /** 多 Agent 编排图，画布的唯一数据源 */
  graph: MultiGraph;
  plugins: string[];
  workflows: string[];
  triggers: string[];
  variables: string[];
  databases: string[];
  longMemoryEnabled: boolean;
}

export interface OpeningConfig {
  openingMessage: string;
  openingQuestions: string[];
  openingQuestionsEnabled: boolean;
}

export interface OrchestrationConfig {
  planner?: PlannerConfig;
  flow?: FlowConfig;
  multi?: MultiConfig;
  opening?: OpeningConfig;
}
