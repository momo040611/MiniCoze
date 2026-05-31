import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  type WorkflowNodeEntity,
} from '@flowgram.ai/free-layout-editor'
import '@flowgram.ai/free-layout-editor/index.css'
import { getWorkflowDetail, type Workflow } from '../../api'
import { useSimpleEditorProps } from './hooks/useSimpleEditorProps'
import Header from './page/Header'
import NodeConfigPanel from './page/NodeConfigPanel'
import Toolbar from './page/Toolbar'
import styles from './index.module.css'

const handleAddNode = (type: string) => {
  console.log('add workflow node:', type)
}

function WorkflowCanvasPage() {
  const { workflowId } = useParams()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<WorkflowNodeEntity | null>(null)

  useEffect(() => {
    if (!workflowId) {
      setWorkflow(null)
      setLoading(false)
      return
    }

    let ignore = false
    setLoading(true)
    setSelectedNode(null)

    getWorkflowDetail(workflowId)
      .then((res) => {
        if (!ignore) {
          setWorkflow(res)
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
        }
      })

    return () => {
      ignore = true
    }
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
        <Header workflow={workflow} />
        <main className={styles.canvasArea}>
          <EditorRenderer />
        </main>
        <NodeConfigPanel selectedNode={selectedNode} />
        <Toolbar onAddNode={handleAddNode} />
      </div>
    </FreeLayoutEditorProvider>
  )
}

export { WorkflowCanvasPage }
