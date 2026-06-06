import Header from './page/Header'
import Toolbar from './page/Toolbar'
import styles from './index.module.css'
import { useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
} from '@flowgram.ai/free-layout-editor'
import type { WorkflowNodeEntity } from '@flowgram.ai/free-layout-editor'
import '@flowgram.ai/free-layout-editor/index.css'
import { message } from 'antd'

import { getWorkflowByIdRemote, type Workflow } from '../../api'
import NodeConfigPanel from './page/NodeConfigPanel'
import RunTestPanel from './page/RunTestPanel'
import { useSimpleEditorProps } from './hooks/useSimpleEditorProps'
import {
  groupValidationErrorsByNodeId,
  validateWorkflow,
  type NodeValidationError,
} from './utils/validateWorkflow'

function getEntityNodeId(node: WorkflowNodeEntity | null) {
  const nodeJson = node?.toJSON?.() as { id?: string } | undefined
  return nodeJson?.id ?? String((node as unknown as { id?: string } | null)?.id ?? '')
}

function WorkflowCanvasPage() {
  const { workflowId } = useParams()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<WorkflowNodeEntity | null>(null)
  const [validationErrors, setValidationErrors] = useState<NodeValidationError[]>([])
  const [runPanelOpen, setRunPanelOpen] = useState(false)
  const [runCanvasData, setRunCanvasData] = useState<Workflow['canvasData'] | null>(null)

  const validationErrorsByNodeId = useMemo(
    () => groupValidationErrorsByNodeId(validationErrors),
    [validationErrors],
  )

  const selectedNodeErrors = useMemo(() => {
    const selectedNodeId = getEntityNodeId(selectedNode)
    return selectedNodeId ? validationErrorsByNodeId[selectedNodeId] ?? [] : []
  }, [selectedNode, validationErrorsByNodeId])

  const handleCanvasChange = useCallback((canvasData: Workflow['canvasData']) => {
    setValidationErrors(validateWorkflow(canvasData))
  }, [])

  const handleRunTest = useCallback((canvasData: Workflow['canvasData']) => {
    const errors = validateWorkflow(canvasData)
    setValidationErrors(errors)
    setSelectedNode(null)
    setRunCanvasData(canvasData)
    setRunPanelOpen(true)

    if (errors.length > 0) {
      const firstError = errors[0]
      message.error(`${firstError.nodeTitle}：${firstError.message}`)
      return false
    }

    setRunCanvasData(canvasData)
    setRunPanelOpen(true)
    return true
  }, [])

  useEffect(() => {
    if (!workflowId) {
      setLoading(false)
      return
    }

    setLoading(true)

    getWorkflowByIdRemote(workflowId)
      .then((res) => {
        setWorkflow(res)
        setValidationErrors(validateWorkflow(res?.canvasData))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [workflowId])

  const editorProps = useSimpleEditorProps({
    workflowId,
    canvasData: workflow?.canvasData,
    onSelectNode: setSelectedNode,
    onCanvasChange: handleCanvasChange,
    validationErrorsByNodeId,
  })

  if (loading) {
    return <div className={styles.loading}>工作流加载中...</div>
  }

  if (!workflow) {
    return <div className={styles.loading}>工作流不存在</div>
  }

  return (
    <FreeLayoutEditorProvider {...editorProps}>
      <div className={styles.workflowPage}>
        <Header workflow={workflow} />

        <main className={styles.canvasArea} onClick={() => setSelectedNode(null)}>
          <EditorRenderer />
        </main>

        <NodeConfigPanel
          selectedNode={selectedNode}
          validationErrors={selectedNodeErrors}
          onNodeDataChange={handleCanvasChange}
          onClose={() => setSelectedNode(null)}
        />

        <Toolbar onRunTest={handleRunTest} />

        <RunTestPanel
          open={runPanelOpen}
          workflowId={workflow.id}
          canvasData={runCanvasData ?? workflow.canvasData}
          onClose={() => setRunPanelOpen(false)}
        />
      </div>
    </FreeLayoutEditorProvider>
  )
}

export { WorkflowCanvasPage }
