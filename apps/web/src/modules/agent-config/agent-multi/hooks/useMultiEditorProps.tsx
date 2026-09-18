import { useEffect, useMemo, useRef, useState } from 'react'
import {
  WorkflowNodeRenderer,
  useNodeRender,
  type FreeLayoutProps,
  type WorkflowJSON,
  type WorkflowNodeEntity,
  type WorkflowNodeProps,
  type WorkflowNodeRegistry,
} from '@flowgram.ai/free-layout-editor'

import type { ModelOption } from '../../../../api/agent-config/model-options'
import type { AgentDetailData, MultiGraph } from '../../agent-detail'
import { createDefaultGraph } from '../default-graph'
import { fromFlowgramJSON, toFlowgramJSON } from '../graph-mapping'
import { MultiNodeCard } from '../nodeRenders'

const nodeRegistries: WorkflowNodeRegistry[] = [
  {
    type: 'start',
    meta: {
      isStart: true,
      deleteDisable: true,
      copyDisable: true,
      defaultPorts: [{ type: 'output' }],
    },
  },
  {
    type: 'agent',
    meta: {
      defaultPorts: [{ type: 'input' }, { type: 'output' }],
    },
  },
  {
    type: 'subAgent',
    meta: {
      defaultPorts: [{ type: 'input' }, { type: 'output' }],
    },
  },
]

/** 节点外壳，真正的卡片内容由 getNodeDefaultRegistry 里的 formMeta.render 提供 */
function MultiNodeShell({ node }: { node: WorkflowNodeEntity }) {
  const { form } = useNodeRender()

  return <WorkflowNodeRenderer node={node}>{form?.render()}</WorkflowNodeRenderer>
}

interface UseMultiEditorPropsParams {
  agent: AgentDetailData
  graph: MultiGraph
  modelOptions: ModelOption[]
  onGraphChange: (graph: MultiGraph) => void
}

export function useMultiEditorProps({ agent, graph, modelOptions, onGraphChange }: UseMultiEditorPropsParams) {
  // 只在挂载时取一次：编辑过程中 config.graph 会被回写，不能反过来重置画布
  const [initialData] = useState(() => toFlowgramJSON(
    graph.nodes.length > 0 ? graph : createDefaultGraph(agent),
  ))

  // 用上一次回写的内容做基线，避免 initialData 挂载产生的变更把智能体误标为「已修改」
  const lastGraphRef = useRef(JSON.stringify(fromFlowgramJSON(initialData)))

  // 回调用 ref 透传，保证 provider props 的引用稳定，不因父组件重渲染而刷新
  const onGraphChangeRef = useRef(onGraphChange)
  useEffect(() => {
    onGraphChangeRef.current = onGraphChange
  }, [onGraphChange])

  return useMemo<FreeLayoutProps>(
    () => ({
      background: false,
      readonly: false,
      initialData: initialData as unknown as WorkflowJSON,
      nodeRegistries,

      getNodeDefaultRegistry(type) {
        const nodeType = String(type)
        return {
          type,
          formMeta: {
            render: () => <MultiNodeCard type={nodeType} modelOptions={modelOptions} />,
          },
        }
      },

      materials: {
        renderDefaultNode: (props: WorkflowNodeProps) => <MultiNodeShell node={props.node} />,
      },

      nodeEngine: {
        enable: true,
      },

      history: {
        enable: true,
        enableChangeNode: true,
      },

      onContentChange(ctx) {
        const nextGraph = fromFlowgramJSON(ctx.document.toJSON())
        const serialized = JSON.stringify(nextGraph)

        if (serialized === lastGraphRef.current) {
          return
        }

        lastGraphRef.current = serialized
        onGraphChangeRef.current(nextGraph)
      },
    }),
    [initialData, modelOptions],
  )
}