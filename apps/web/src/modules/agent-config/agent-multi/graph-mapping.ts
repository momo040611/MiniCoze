import type { MultiGraph, MultiGraphEdge, MultiGraphNode, MultiNodeType } from '../agent-detail'

/** 存进 Flowgram 节点 data 的节点配置：MultiGraphNode 去掉图结构与坐标 */
export type MultiNodeData = Omit<MultiGraphNode, 'id' | 'type' | 'x' | 'y'>

interface FlowgramNodeJSON {
  id: string
  type: string
  meta: { position: { x: number; y: number } }
  data: MultiNodeData
}

interface FlowgramEdgeJSON {
  sourceNodeID: string
  targetNodeID: string
}

export interface FlowgramJSON {
  nodes: FlowgramNodeJSON[]
  edges: FlowgramEdgeJSON[]
}

const NODE_TYPES: MultiNodeType[] = ['start', 'agent', 'subAgent']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNodeType(value: unknown): MultiNodeType {
  return NODE_TYPES.includes(value as MultiNodeType) ? (value as MultiNodeType) : 'subAgent'
}

function toNodeId(value: unknown, type: MultiNodeType, index: number): string {
  return typeof value === 'string' && value ? value : `node-${type}-${index}`
}

/** MultiGraph → Flowgram 的 initialData */
export function toFlowgramJSON(graph: MultiGraph): FlowgramJSON {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      meta: { position: { x: node.x, y: node.y } },
      data: {
        label: node.label,
        subtitle: node.subtitle,
        avatar: node.avatar,
        modelName: node.modelName,
        skills: node.skills,
        useCase: node.useCase,
        prompt: node.prompt,
        suggestions: node.suggestions,
        hasUserCustomPrompt: node.hasUserCustomPrompt,
      },
    })),
    edges: graph.edges.map((edge) => ({
      sourceNodeID: edge.fromNodeId,
      targetNodeID: edge.toNodeId,
    })),
  }
}

/** Flowgram 的 document.toJSON() → MultiGraph */
export function fromFlowgramJSON(json: unknown): MultiGraph {
  const record = isRecord(json) ? json : {}
  const rawNodes = Array.isArray(record.nodes) ? record.nodes : []
  const rawEdges = Array.isArray(record.edges) ? record.edges : []

  const nodes: MultiGraphNode[] = rawNodes.filter(isRecord).map((raw, index) => {
    const type = toNodeType(raw.type)
    const data = isRecord(raw.data) ? raw.data : {}
    const meta = isRecord(raw.meta) ? raw.meta : {}
    const position = isRecord(meta.position) ? meta.position : {}

    return {
      id: toNodeId(raw.id, type, index),
      type,
      x: typeof position.x === 'number' ? position.x : 0,
      y: typeof position.y === 'number' ? position.y : 0,
      ...(data as Partial<MultiNodeData>),
      label: typeof data.label === 'string' && data.label ? data.label : '未命名节点',
    }
  })

  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges: MultiGraphEdge[] = rawEdges
    .filter(isRecord)
    .map((raw) => ({
      fromNodeId: String(raw.sourceNodeID ?? raw.source ?? ''),
      toNodeId: String(raw.targetNodeID ?? raw.target ?? ''),
    }))
    .filter((edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId))
    .map((edge) => ({
      // 连线的身份就是它连接的两个端点
      id: `edge-${edge.fromNodeId}-${edge.toNodeId}`,
      ...edge,
    }))

  return { nodes, edges }
}