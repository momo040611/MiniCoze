import Header from './page/Header'
import Toolbar from './page/Toolbar'
import styles from './index.module.css'
import { useParams } from 'react-router-dom'
import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
} from '@flowgram.ai/free-layout-editor'
import type { WorkflowNodeEntity } from '@flowgram.ai/free-layout-editor'
import '@flowgram.ai/free-layout-editor/index.css'
import { message, Modal } from 'antd'

import { getWorkflowByIdRemote, type Workflow } from '../../api'
import { getWorkflowVersions, publishWorkflow, type WorkflowVersionItem } from '../../api/publish'
import NodeConfigPanel from './page/NodeConfigPanel'
import RunTestPanel from './page/RunTestPanel'
import { useSimpleEditorProps } from './hooks/useSimpleEditorProps'
import {
  groupValidationErrorsByNodeId,
  validateWorkflow,
  type NodeValidationError,
} from './utils/validateWorkflow'

class WorkflowCanvasErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Workflow canvas render failed:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.loading}>
          Workflow canvas render failed: {this.state.error.message}
        </div>
      )
    }

    return this.props.children
  }
}

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'failed'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [versions, setVersions] = useState<WorkflowVersionItem[]>([])

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
      message.error(`${firstError.nodeTitle}: ${firstError.message}`)
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
    setLoadError(null)

    getWorkflowByIdRemote(workflowId)
      .then((res) => {
        setWorkflow(res)
        setValidationErrors(validateWorkflow(res?.canvasData))
      })
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : String(error)
        console.error('Load workflow failed:', error)
        setWorkflow(null)
        setLoadError(messageText)
        message.error(messageText || 'Workflow load failed')
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
    onDirty: useCallback(() => {
      setSaveStatus('dirty')
    }, []),
    onSaveStart: useCallback(() => {
      setSaveStatus('saving')
    }, []),
    onSaveSuccess: useCallback(() => {
      setSaveStatus('saved')
      setLastSavedAt(new Date().toLocaleTimeString())
    }, []),
    onSaveError: useCallback(() => {
      setSaveStatus('failed')
    }, []),
  })

  const handlePublish = useCallback(() => {
    if (!workflowId || !workflow) return

    Modal.confirm({
      title: workflow.status === 'ACTIVE' ? '重新发布该工作流？' : '发布该工作流？',
      content: '发布后将以当前草稿生成新版本，可通过 API Key 渠道调用。',
      okText: '发布',
      cancelText: '取消',
      onOk: async () => {
        setPublishing(true)
        try {
          const result = await publishWorkflow(workflowId)
          message.success(`发布成功：v${result.version}`)
          setSaveStatus('saved')
          const refreshed = await getWorkflowByIdRemote(workflowId)
          setWorkflow(refreshed)
        } catch (error) {
          message.error(error instanceof Error ? error.message : '发布失败')
          throw error
        } finally {
          setPublishing(false)
        }
      },
    })
  }, [workflowId, workflow])

  const handleShowHistory = useCallback(async () => {
    if (!workflowId) return
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const list = await getWorkflowVersions(workflowId)
      setVersions(list)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载版本历史失败')
    } finally {
      setHistoryLoading(false)
    }
  }, [workflowId])

  if (loading) {
    return <div className={styles.loading}>Workflow loading...</div>
  }

  if (!workflow) {
    return <div className={styles.loading}>{loadError || 'Workflow not found'}</div>
  }

  return (
    <WorkflowCanvasErrorBoundary key={workflow.id}>
      <FreeLayoutEditorProvider key={workflow.id} {...editorProps}>
      <div className={styles.workflowPage}>
        <Header
          workflow={workflow}
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          onPublish={handlePublish}
          onShowHistory={() => void handleShowHistory()}
          publishing={publishing}
        />

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

        <Modal
          title="版本历史"
          open={historyOpen}
          footer={null}
          onCancel={() => setHistoryOpen(false)}
          width={520}
        >
          {historyLoading ? (
            <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>
          ) : versions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              暂无发布版本，点击右上角「发布」生成第一个版本
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {versions.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 4px',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <span>
                    <strong>v{item.version}</strong>
                    {item.isPublished ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          color: '#22c55e',
                        }}
                      >
                        当前发布版本
                      </span>
                    ) : null}
                  </span>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleString()
                      : '未发布'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      </div>
      </FreeLayoutEditorProvider>
    </WorkflowCanvasErrorBoundary>
  )
}

export { WorkflowCanvasPage }

