import Header from './page/Header'
import Toolbar from './page/Toolbar'
import styles from './index.module.css'
import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
} from '@flowgram.ai/free-layout-editor'
import type { WorkflowNodeEntity } from '@flowgram.ai/free-layout-editor'
import '@flowgram.ai/free-layout-editor/index.css'

import { getWorkflowDetail, type Workflow } from '../../api'
import NodeConfigPanel from './page/NodeConfigPanel'
import { useSimpleEditorProps } from './hooks/useSimpleEditorProps'

function WorkflowCanvasPage() {
  const { workflowId } = useParams()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<WorkflowNodeEntity | null>(null)

  useEffect(() => {
    if (!workflowId) {
      setLoading(false)
      return
    }

    setLoading(true)

    getWorkflowDetail(workflowId)
      .then((res) => {
        setWorkflow(res)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [workflowId])

  const editorProps = useSimpleEditorProps({
    workflowId,
    canvasData: workflow?.canvasData,
    onSelectNode: setSelectedNode,
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
        <Header />

        <main className={styles.canvasArea}>
          <EditorRenderer />
        </main>

        <NodeConfigPanel selectedNode={selectedNode} />

        <Toolbar />
      </div>
    </FreeLayoutEditorProvider>
  )
}

export { WorkflowCanvasPage }