// 智能体可选模型列表 —— 统一维护，所有模式组件共享
// 后续可改为从后端 /ai-gateway/models 接口获取
export interface ModelOption {
  label: string
  value: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  { label: 'DeepSeek V4 Flash', value: 'deepseek-v4-flash' },
  { label: 'DeepSeek V4 Pro', value: 'deepseek-v4-pro' },
]

/** 默认模型：取列表第一项，保证始终与下拉选项一致 */
export const DEFAULT_AGENT_MODEL = MODEL_OPTIONS[0]?.value ?? 'deepseek-v4-flash'
