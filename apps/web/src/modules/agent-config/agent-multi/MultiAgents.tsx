import React, { useState } from 'react'
import styles from '../agent-detail/agent-detail.module.css'
import multiStyles from './MultiAgents.module.css'
import plannerStyles from '../agent-planner/SingleAgentPlanner.module.css'
import type { AgentDetailData, MultiConfig, OpeningConfig } from '../agent-detail'
import type { ModelOption } from '../../../api/agent-config/model-options'
import { OpeningMessageEditor } from '../components/OpeningMessageEditor'
import { PreviewChat } from '../components/PreviewChat'
import { KnowledgeSelectModal } from '../components/KnowledgeSelectModal'
import { DatabaseTags } from '../components/DatabaseTags'
import { WorkflowSelectModal } from '../components/WorkflowSelectModal'
import { WorkflowTags } from '../components/WorkflowTags'
import { AddPluginModal } from '../components/AddPluginModal'
import type { IPlugin } from '../../../api/plugins'
import { useCanvas } from './hooks/useCanvas'
import { calculateBezierPath, getPortPosition } from './utils'
import { MIN_SCALE, MAX_SCALE } from './constants'
import { CanvasNodeRenderer } from './components/CanvasNodes'
import type { CanvasNode } from './types'

interface Props {
  agent: AgentDetailData
  persona: string
  setPersona: (v: string) => void
  model: string
  modelOptions: ModelOption[]
  onModelChange: (v: string) => void
  temperature: number
  contextLimit: number
  onTemperatureChange: (v: number) => void
  onContextLimitChange: (v: number) => void
  config: MultiConfig
  onConfigChange: (config: MultiConfig) => void
  openingConfig: OpeningConfig
  onOpeningChange: (config: OpeningConfig) => void
}

function CollapsePanel({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.collapsePanel}>
      <div className={styles.collapseHeader} onClick={() => setOpen(!open)}>
        <span className={styles.collapseTitle}>{title}</span>
        <span className={`${styles.collapseArrow} ${open ? styles.collapseArrowOpen : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <div className={`${styles.collapseContent} ${open ? styles.collapseContentOpen : ''}`}>{children}</div>
    </div>
  )
}

function ConfigPanel({
  persona, setPersona,
  model, modelOptions, onModelChange, modelOpen, setModelOpen,
  temperature, contextLimit,
  onTemperatureChange, onContextLimitChange,
  config, onConfigChange,
  openingConfig, onOpeningChange,
  agent, setDialogFlow, setDatabase,
  setPluginModalOpen,
}: {
  persona: string; setPersona: (v: string) => void
  model: string; modelOptions: ModelOption[]; onModelChange: (v: string) => void
  modelOpen: boolean; setModelOpen: (v: boolean) => void
  temperature: number; contextLimit: number
  onTemperatureChange: (v: number) => void; onContextLimitChange: (v: number) => void
  config: MultiConfig; onConfigChange: (config: MultiConfig) => void
  openingConfig: OpeningConfig; onOpeningChange: (config: OpeningConfig) => void
  agent: AgentDetailData
  setDialogFlow: (v: boolean) => void; setDatabase: (v: boolean) => void
  setPluginModalOpen: (v: boolean) => void
}) {
  return (
    <div className={styles.col} style={{ flex: '0 0 320px', minWidth: 280 }}>
      <div className={styles.colHeader}>
        <h3 className={styles.colTitle}>编排</h3>
      </div>
      <div className={styles.colBody}>
        <CollapsePanel title="人设与回复逻辑">
          <textarea
            className={styles.panelTextarea}
            placeholder="定义主 Agent 的基础人设，例如：\n你是一个协调者，负责将任务分发给合适的子 Agent..."
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={6}
          />
          <span className={styles.charCount}>{persona.length} 字</span>
        </CollapsePanel>

        <CollapsePanel title="模型参数">
          <div className={plannerStyles.modelSelector}>
            <div
              className={plannerStyles.modelTrigger}
              onClick={() => setModelOpen(!modelOpen)}
            >
              <span className={plannerStyles.modelName}>{modelOptions.find(m => m.value === model)?.label ?? model}</span>
              <span className={`${plannerStyles.modelArrow} ${modelOpen ? plannerStyles.modelArrowOpen : ''}`}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            {modelOpen && (
              <div className={plannerStyles.modelDropdown}>
                {modelOptions.map((m) => (
                  <button
                    key={m.value}
                    className={`${plannerStyles.modelOption} ${m.value === model ? plannerStyles.modelOptionActive : ''}`}
                    onClick={() => {
                      onModelChange(m.value)
                      setModelOpen(false)
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}>
              <div className={styles.configRowText}>
                <span className={styles.configRowName}>Temperature</span>
                <span className={styles.configRowDesc}>控制回复随机性，数值越高越发散</span>
              </div>
            </div>
            <div className={styles.configRowRight}>
              <div className={styles.paramControl}>
                <input className={styles.paramRange} type="range" min={0} max={2} step={0.1} value={temperature} onChange={(e) => onTemperatureChange(Number(e.target.value))} />
                <input className={styles.paramNumber} type="number" min={0} max={2} step={0.1} value={temperature} onChange={(e) => { const next = Math.min(2, Math.max(0, Number(e.target.value) || 0)); onTemperatureChange(Number(next.toFixed(1))) }} />
              </div>
            </div>
          </div>
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}>
              <div className={styles.configRowText}>
                <span className={styles.configRowName}>上下文轮数</span>
                <span className={styles.configRowDesc}>控制运行时携带的历史消息数量</span>
              </div>
            </div>
            <div className={styles.configRowRight}>
              <div className={styles.paramControl}>
                <select className={styles.paramSelect} value={contextLimit} onChange={(e) => onContextLimitChange(Number(e.target.value))}>
                  <option value={0}>不携带</option>
                  <option value={5}>5 条</option>
                  <option value={10}>10 条</option>
                  <option value={20}>20 条</option>
                  <option value={50}>50 条</option>
                  <option value={100}>100 条</option>
                </select>
              </div>
            </div>
          </div>
        </CollapsePanel>

        <CollapsePanel title="技能">
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}>
              <div className={styles.configRowText}>
                <span className={styles.configRowName}>插件</span>
                <span className={styles.configRowDesc}>添加 AI 能力插件</span>
              </div>
            </div>
            <div className={styles.configRowRight}>
              {config.plugins.length > 0 && (
                <span className={styles.configRowCount}>{config.plugins.length} 个插件</span>
              )}
              <button className={styles.addBtn} onClick={() => setPluginModalOpen(true)}>
                <span>+</span>
              </button>
            </div>
          </div>
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}><div className={styles.configRowText}><span className={styles.configRowName}>工作流</span></div></div>
            <div className={styles.configRowRight}>
              <WorkflowTags
                ids={config.workflows}
                onRemove={(id) => onConfigChange({ ...config, workflows: config.workflows.filter(w => w !== id) })}
                onAdd={() => setDialogFlow(true)}
              />
            </div>
          </div>
        </CollapsePanel>

        <CollapsePanel title="触发器">
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}>
              <div className={styles.configRowText}>
                <span className={styles.configRowName}>触发器配置</span>
                <span className={styles.configRowDesc}>设置多 Agent 协作触发条件</span>
              </div>
            </div>
            <div className={styles.configRowRight}><button className={styles.addBtn}><span>+</span></button></div>
          </div>
        </CollapsePanel>

        <CollapsePanel title="记忆">
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}><div className={styles.configRowText}><span className={styles.configRowName}>变量</span></div></div>
            <div className={styles.configRowRight}><button className={styles.addBtn}><span>+</span></button></div>
          </div>
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}><div className={styles.configRowText}><span className={styles.configRowName}>知识库</span></div></div>
            <div className={styles.configRowRight}>
              <DatabaseTags
                ids={config.databases}
                onRemove={(id) => onConfigChange({ ...config, databases: config.databases.filter(d => d !== id) })}
                onAdd={() => setDatabase(true)}
              />
            </div>
          </div>
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}><div className={styles.configRowText}><span className={styles.configRowName}>长期记忆</span></div></div>
            <div className={styles.configRowRight}>
              <label className={styles.toggleSwitch}>
                <input type="checkbox" checked={config.longMemoryEnabled} onChange={(e) => onConfigChange({ ...config, longMemoryEnabled: e.target.checked })} />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          </div>
        </CollapsePanel>

        <CollapsePanel title="对话体验">
          <OpeningMessageEditor agentName={agent.name} config={openingConfig} onChange={onOpeningChange} defaultOpen={!!openingConfig.openingMessage} />
        </CollapsePanel>
      </div>
    </div>
  )
}

export function MultiAgents({
  agent, persona, setPersona,
  model, modelOptions, onModelChange, temperature, contextLimit,
  onTemperatureChange, onContextLimitChange,
  config, onConfigChange,
  openingConfig, onOpeningChange,
}: Props) {
  const [database, setDatabase] = useState(false)
  const [dialogFlow, setDialogFlow] = useState(false)
  const [pluginModalOpen, setPluginModalOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)

  const canvas = useCanvas({ agent, subAgents: config.subAgents })

  const getNodeClass = (node: CanvasNode): string => {
    const isSelected = canvas.selectedNodeId === node.id
    const isDragging = canvas.dragInfo?.nodeId === node.id
    let cls = `${multiStyles.canvasNode}`
    if (isSelected) cls += ` ${multiStyles.canvasNodeSelected}`
    if (isDragging) cls += ` ${multiStyles.canvasNodeDragging}`
    return cls
  }

  const nodeRendererProps = {
    isSelected: false,
    isDragging: false,
    connectingFromNodeId: canvas.connectingFrom?.nodeId ?? null,
    onNodeMouseDown: canvas.handleNodeMouseDown,
    onPortMouseDown: canvas.handlePortMouseDown,
    onPortMouseUp: canvas.handlePortMouseUp,
    onNodeResize: canvas.setNodeHeight,
    getNodeClass,
  }

  return (
    <>
      <ConfigPanel
        persona={persona} setPersona={setPersona}
        model={model} modelOptions={modelOptions} onModelChange={onModelChange} modelOpen={modelOpen} setModelOpen={setModelOpen}
        temperature={temperature} contextLimit={contextLimit}
        onTemperatureChange={onTemperatureChange} onContextLimitChange={onContextLimitChange}
        config={config} onConfigChange={onConfigChange}
        openingConfig={openingConfig} onOpeningChange={onOpeningChange}
        agent={agent}
        setDialogFlow={setDialogFlow} setDatabase={setDatabase}
        setPluginModalOpen={setPluginModalOpen}
      />

      <div className={styles.col} style={{ flex: 1, minWidth: 400 }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>编排画布</h3>
        </div>
        <div className={styles.colBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div className={multiStyles.canvasWrap}>
            <div
              ref={canvas.viewportRef}
              className={`${multiStyles.canvasViewport} ${canvas.isPanning ? 'panning' : ''} ${canvas.connectingFrom ? 'connecting' : ''}`}
              onMouseDown={canvas.handleViewportMouseDown}
              onMouseMove={canvas.handleViewportMouseMove}
              onMouseUp={canvas.handleViewportMouseUp}
              onMouseLeave={canvas.handleViewportMouseUp}
              onClick={canvas.handleCanvasMouseUp}
            >
              <div
                className={multiStyles.canvasContent}
                style={{ transform: `translate(${canvas.offset.x}px, ${canvas.offset.y}px) scale(${canvas.scale})` }}
              >
                <div className={multiStyles.canvasGrid} />

                <svg className={multiStyles.canvasSvg}>
                  <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
                      <path d="M0,0 L6,2.5 L0,5 Z" fill="#3b82f6" />
                    </marker>
                  </defs>
                  {canvas.connections.map(conn => {
                    const fromNode = canvas.nodeMap.get(conn.fromNodeId)
                    const toNode = canvas.nodeMap.get(conn.toNodeId)
                    if (!fromNode || !toNode) return null
                    const fromH = canvas.nodeHeightsRef.current.get(fromNode.id)
                    const toH = canvas.nodeHeightsRef.current.get(toNode.id)
                    const fromPos = getPortPosition(fromNode, 'output', fromH)
                    const toPos = getPortPosition(toNode, 'input', toH)
                    const d = calculateBezierPath(fromPos.x, fromPos.y, toPos.x, toPos.y)
                    return (
                      <g key={conn.id}>
                        <path
                          d={d}
                          className={multiStyles.connectionHit}
                        />
                        <path
                          d={d}
                          className={multiStyles.connectionLine}
                          markerEnd="url(#arrowhead)"
                        />
                      </g>
                    )
                  })}
                  {canvas.connectingFrom && (
                    <path
                      d={calculateBezierPath(canvas.connectingFrom.x, canvas.connectingFrom.y, canvas.connectingFrom.x + 200, canvas.connectingFrom.y)}
                      className={multiStyles.tempConnection}
                      markerEnd="url(#arrowhead)"
                    />
                  )}
                </svg>

                {canvas.nodes.map(node => {
                  const props = {
                    ...nodeRendererProps,
                    node,
                    isSelected: canvas.selectedNodeId === node.id,
                    isDragging: canvas.dragInfo?.nodeId === node.id,
                  }
                  return <CanvasNodeRenderer key={node.id} {...props} />
                })}

                {canvas.nodes.length === 0 && (
                  <div className={multiStyles.canvasPlaceholder}>
                    <div className={multiStyles.canvasPlaceholderIcon}>+</div>
                    <span>从下方工具栏添加节点</span>
                  </div>
                )}
              </div>
            </div>

            <div className={multiStyles.canvasToolbar}>
              <div className={multiStyles.canvasToolbarLeft} style={{ position: 'relative' }}>
                <button
                  className={`${multiStyles.canvasToolBtn} ${canvas.showNodeMenu ? multiStyles.canvasToolBtnActive : ''}`}
                  onClick={() => canvas.setShowNodeMenu(!canvas.showNodeMenu)}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  添加节点
                </button>
                {canvas.showNodeMenu && (
                  <div className={multiStyles.nodeMenu}>
                    <button className={multiStyles.nodeMenuItem} onClick={() => canvas.addNode('start')}>
                      <div className={`${multiStyles.nodeMenuIcon} ${multiStyles.nodeMenuIconStart}`}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2.5 1L11 6L2.5 11V1Z" /></svg>
                      </div>
                      <div className={multiStyles.nodeMenuInfo}>
                        <span className={multiStyles.nodeMenuName}>开始节点</span>
                        <span className={multiStyles.nodeMenuDesc}>流程起点</span>
                      </div>
                    </button>
                    <button className={multiStyles.nodeMenuItem} onClick={() => canvas.addNode('agent', '主 Agent', '主 Agent')}>
                      <div className={`${multiStyles.nodeMenuIcon} ${multiStyles.nodeMenuIconAgent}`}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                          <circle cx="7" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                        </svg>
                      </div>
                      <div className={multiStyles.nodeMenuInfo}>
                        <span className={multiStyles.nodeMenuName}>主 Agent 节点</span>
                        <span className={multiStyles.nodeMenuDesc}>主协调智能体</span>
                      </div>
                    </button>
                    <button className={multiStyles.nodeMenuItem} onClick={() => canvas.addNode('subAgent', `子 Agent ${canvas.nodes.filter(n => n.type === 'subAgent').length + 1}`, '子 Agent')}>
                      <div className={`${multiStyles.nodeMenuIcon} ${multiStyles.nodeMenuIconSub}`}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>A</span>
                      </div>
                      <div className={multiStyles.nodeMenuInfo}>
                        <span className={multiStyles.nodeMenuName}>子 Agent 节点</span>
                        <span className={multiStyles.nodeMenuDesc}>子任务智能体</span>
                      </div>
                    </button>
                  </div>
                )}
                <button className={multiStyles.canvasToolBtn} onClick={canvas.handleUndo} disabled={!canvas.canUndo}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4H8C9.1 4 10 4.9 10 6C10 7.1 9.1 8 8 8H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M5 5L3 3.5L5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  撤销
                </button>
                <button className={multiStyles.canvasToolBtn} onClick={canvas.handleRedo} disabled={!canvas.canRedo}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M9 4H4C2.9 4 2 4.9 2 6C2 7.1 2.9 8 4 8H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M7 5L9 3.5L7 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  重做
                </button>
              </div>
              <div className={multiStyles.canvasToolbarRight}>
                <button className={multiStyles.canvasToolBtn} onClick={canvas.handleZoomOut} title="缩小" disabled={canvas.scale <= MIN_SCALE}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8 8L11 11M3 5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
                <span className={multiStyles.zoomLabel} onClick={canvas.handleResetView}>{canvas.zoomPercent}%</span>
                <button className={multiStyles.canvasToolBtn} onClick={canvas.handleZoomIn} title="放大" disabled={canvas.scale >= MAX_SCALE}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8 8L11 11M5 3V7M3 5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
                <button className={multiStyles.canvasToolBtn} onClick={canvas.handleFitContent} title="居中显示">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1V3M6 9V11M1 6H3M9 6H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
                <button className={multiStyles.canvasToolBtn} onClick={canvas.toggleFullscreen} title="全屏">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 4V1H4M8 1H11V4M11 8V11H8M4 11H1V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button className={multiStyles.canvasToolBtn} onClick={canvas.handleResetView} title="重置视图">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1V3M6 9V11M1 6H3M9 6H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.col} style={{ flex: '0 0 360px', minWidth: 320 }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>预览与调试</h3>
        </div>
        <div className={styles.colBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <PreviewChat
            agentId={agent.id}
            agentName={agent.name}
            avatar={agent.avatar}
            persona={persona}
            model={model}
            temperature={temperature}
            openingConfig={openingConfig}
          />
          <WorkflowSelectModal
            visible={dialogFlow}
            onClose={() => setDialogFlow(false)}
            selectedIds={config.workflows}
            onRemove={(id) => onConfigChange({ ...config, workflows: config.workflows.filter(w => w !== id) })}
            onSelect={(wf) => {
              if (!config.workflows.includes(wf.id)) {
                onConfigChange({ ...config, workflows: [...config.workflows, wf.id] })
              }
            }}
          />
          <KnowledgeSelectModal
            visible={database}
            onClose={() => setDatabase(false)}
            selectedIds={config.databases}
            onRemove={(id) => onConfigChange({ ...config, databases: config.databases.filter(d => d !== id) })}
            onSelect={(kb) => {
              if (!config.databases.includes(kb.id)) {
                onConfigChange({ ...config, databases: [...config.databases, kb.id] })
              }
            }}
          />
          <AddPluginModal
            visible={pluginModalOpen}
            onClose={() => setPluginModalOpen(false)}
            selectedIds={config.plugins}
            onSelect={(selectedPlugins: IPlugin[]) => {
              onConfigChange({ ...config, plugins: selectedPlugins.map((p) => p.id) })
            }}
          />
        </div>
      </div>
    </>
  )
}