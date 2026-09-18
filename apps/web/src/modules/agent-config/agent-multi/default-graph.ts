import type { AgentDetailData, MultiGraph } from '../agent-detail'

// 初始布局：开始节点 → 主 Agent，左边距与列间距按节点大致宽度预留
const START_X = 140
const START_Y = 300
const AGENT_X = 420
const AGENT_Y = 100

/**
 * 新建多 Agent 智能体的初始图：开始节点 + 主 Agent。
 * 子 Agent 由用户在画布上按需添加，其余节点配置留空待用户填写。
 */
export function createDefaultGraph(agent: AgentDetailData): MultiGraph {
  return {
    nodes: [
      {
        id: 'node-start',
        type: 'start',
        x: START_X,
        y: START_Y,
        label: '开始',
      },
      {
        id: 'node-agent',
        type: 'agent',
        x: AGENT_X,
        y: AGENT_Y,
        label: agent.name,
        subtitle: '主控 Agent',
        avatar: agent.avatar,
        modelName: agent.model,
      },
    ],
    edges: [
      {
        // 与 fromFlowgramJSON 生成的连线 id 保持一致，便于内容比对
        id: 'edge-node-start-node-agent',
        fromNodeId: 'node-start',
        toNodeId: 'node-agent',
      },
    ],
  }
}