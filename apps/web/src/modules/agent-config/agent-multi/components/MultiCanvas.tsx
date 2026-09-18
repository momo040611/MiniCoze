import { useRef, useState } from 'react'
import { EditorRenderer, useClientContext, usePlaygroundTools, useUndoRedo } from '@flowgram.ai/free-layout-editor'
import type { MultiNodeType } from '../../agent-detail'
import styles from '../MultiAgents.module.css'

const NODE_MENU_ITEMS: Array<{ type: MultiNodeType; name: string; desc: string }> = [
  { type: 'agent', name: '主 Agent 节点', desc: '主协调智能体' },
  { type: 'subAgent', name: '子 Agent 节点', desc: '子任务智能体' },
]

/** Flowgram 未公开的类型化入口，与 workflow-canvas 的用法保持一致 */
type PlaygroundContextWithZoom = {
  playground?: {
    config?: {
      updateZoom?: (zoom: number, easing?: boolean, easingDuration?: number) => void
    }
  }
}

export function MultiCanvas({ agentName }: { agentName: string }) {
  const ctx = useClientContext()
  const tools = usePlaygroundTools({ minZoom: 0.25, maxZoom: 2 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const [showNodeMenu, setShowNodeMenu] = useState(false)
  const { canUndo, canRedo, undo, redo } = useUndoRedo()

  function handleAddNode(type: MultiNodeType) {
    const existingCount = ctx.document.toJSON().nodes?.length ?? 0
    const isSubAgent = type === 'subAgent'

    ctx.document.createWorkflowNodeByType(type, { x: 160, y: 200 }, {
      id: `${type}_${Date.now()}`,
      data: {
        label: isSubAgent ? `子 Agent ${existingCount}` : agentName,
        subtitle: isSubAgent ? '子 Agent' : '主控 Agent',
        modelName: '',
      },
    })

    setShowNodeMenu(false)
  }

  function handleResetZoom() {
    const playground = (ctx as unknown as PlaygroundContextWithZoom).playground
    playground?.config?.updateZoom?.(1, true, 200)
  }

  function handleFullscreen() {
    const element = wrapRef.current
    if (!element) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
      return
    }

    element.requestFullscreen()
  }

  return (
    <div className={styles.canvasWrap} ref={wrapRef}>
      <div className={styles.canvasViewport}>
        <EditorRenderer />
      </div>

      <div className={styles.canvasToolbar}>
        <div className={styles.canvasToolbarLeft} style={{ position: 'relative' }}>
          <button
            className={`${styles.canvasToolBtn} ${showNodeMenu ? styles.canvasToolBtnActive : ''}`}
            onClick={() => setShowNodeMenu((prev) => !prev)}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            添加节点
          </button>

          {showNodeMenu && (
            <div className={styles.nodeMenu}>
              {NODE_MENU_ITEMS.map((item) => (
                <button
                  key={item.type}
                  className={styles.nodeMenuItem}
                  onClick={() => handleAddNode(item.type)}
                >
                  <div
                    className={`${styles.nodeMenuIcon} ${
                      item.type === 'subAgent' ? styles.nodeMenuIconSub : styles.nodeMenuIconAgent
                    }`}
                  >
                    {item.type === 'subAgent' ? (
                      <span style={{ fontWeight: 600, fontSize: 12 }}>A</span>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                        <circle cx="7" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.nodeMenuInfo}>
                    <span className={styles.nodeMenuName}>{item.name}</span>
                    <span className={styles.nodeMenuDesc}>{item.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            className={styles.canvasToolBtn}
            onClick={() => { void undo() }}
            disabled={!canUndo}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4H8C9.1 4 10 4.9 10 6C10 7.1 9.1 8 8 8H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M5 5L3 3.5L5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            撤销
          </button>
          <button
            className={styles.canvasToolBtn}
            onClick={() => { void redo() }}
            disabled={!canRedo}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M9 4H4C2.9 4 2 4.9 2 6C2 7.1 2.9 8 4 8H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M7 5L9 3.5L7 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            重做
          </button>
        </div>

        <div className={styles.canvasToolbarRight}>
          <button className={styles.canvasToolBtn} onClick={() => tools.zoomout(true)} title="缩小">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 8L11 11M3 5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <span className={styles.zoomLabel} onClick={() => tools.fitView(true)}>
            {Math.round(tools.zoom * 100)}%
          </span>
          <button className={styles.canvasToolBtn} onClick={() => tools.zoomin(true)} title="放大">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 8L11 11M5 3V7M3 5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button className={styles.canvasToolBtn} onClick={() => tools.fitView(true)} title="居中显示">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1V3M6 9V11M1 6H3M9 6H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button className={styles.canvasToolBtn} onClick={handleFullscreen} title="全屏">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 4V1H4M8 1H11V4M11 8V11H8M4 11H1V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className={styles.canvasToolBtn} onClick={handleResetZoom} title="重置为 100%">
            100%
          </button>
        </div>
      </div>
    </div>
  )
}