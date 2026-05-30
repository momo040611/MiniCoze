import React, { useState } from 'react'
import styles from '../agent-detail/agent-detail.module.css'
import multiStyles from './MultiAgents.module.css'
import type { AgentDetailData, MultiConfig, OpeningConfig } from '../agent-detail'
import { OpeningMessageEditor } from '../components/OpeningMessageEditor'
import { PreviewChat } from '../components/PreviewChat'
import { SelectModal } from '../components/SelectModal'
import { useNavigate } from 'react-router-dom'
interface Props {
  agent: AgentDetailData
  persona: string
  setPersona: (v: string) => void
  model: string
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

export function MultiAgents({
  agent,
  persona,
  setPersona,
  model,
  temperature,
  contextLimit,
  onTemperatureChange,
  onContextLimitChange,
  config,
  onConfigChange,
  openingConfig,
  onOpeningChange,
}: Props) {
  const navigate = useNavigate()
  const { subAgents, longMemoryEnabled } = config
  const [database, setDatabase] = useState(false)
  const [dialogFlow, setDialogFlow] = useState(false)
  const handleAddAgent = () => {
    const newAgent = {
      id: `agent-${Date.now()}`,
      name: `Agent ${subAgents.length + 1}`,
    }
    onConfigChange({ ...config, subAgents: [...subAgents, newAgent] })
  }
  const updateConfig = (patch: Partial<MultiConfig>) => {
    onConfigChange({ ...config, ...patch })
  }

  return (
    <>
      {/* 左侧栏：配置面板 */}
      <div className={styles.col} style={{ flex: '0 0 320px', minWidth: 280 }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>编排</h3>
        </div>
        <div className={styles.colBody}>
          <CollapsePanel title="人设与回复逻辑">
            <textarea
              className={styles.panelTextarea}
              placeholder={`定义主 Agent 的基础人设，例如：\n你是一个协调者，负责将任务分发给合适的子 Agent...`}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows={6}
            />
            <span className={styles.charCount}>{persona.length} 字</span>
          </CollapsePanel>

          <CollapsePanel title="模型参数">
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>Temperature</span>
                  <span className={styles.configRowDesc}>控制回复随机性，数值越高越发散</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                <div className={styles.paramControl}>
                <input
                  className={styles.paramRange}
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature}
                  onChange={(event) => onTemperatureChange(Number(event.target.value))}
                />
                <input
                  className={styles.paramNumber}
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature}
                  onChange={(event) => {
                    const next = Math.min(2, Math.max(0, Number(event.target.value) || 0))
                    onTemperatureChange(Number(next.toFixed(1)))
                  }}
                />
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
                <select
                  className={styles.paramSelect}
                  value={contextLimit}
                  onChange={(event) => onContextLimitChange(Number(event.target.value))}
                >
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
                </div>
              </div>
              <div className={styles.configRowRight}>
                <button className={styles.addBtn} ><span>+</span></button>
              </div>
            </div>
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>工作流</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                <button className={styles.addBtn} onClick={() => setDialogFlow(true)}><span>+</span></button>
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
              <div className={styles.configRowRight}>
                
                <button className={styles.addBtn}><span>+</span></button>
              </div>
            </div>
          </CollapsePanel>

          <CollapsePanel title="记忆">
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>变量</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                
                <button className={styles.addBtn} ><span>+</span></button>
              </div>
            </div>
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>数据库</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                
                <button className={styles.addBtn} onClick={() => setDatabase(true)}><span>+</span></button>
              </div>
            </div>
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>长期记忆</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                <label className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={longMemoryEnabled}
                    onChange={(e) => updateConfig({ longMemoryEnabled: e.target.checked })}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            </div>
          </CollapsePanel>

          <CollapsePanel title="对话体验">
            <OpeningMessageEditor
              agentName={agent.name}
              config={openingConfig}
              onChange={onOpeningChange}
              defaultOpen={!!openingConfig.openingMessage}
            />
          </CollapsePanel>
        </div>
      </div>

      {/* 中间栏：可视化画布 */}
      <div className={styles.col} style={{ flex: 1, minWidth: 400 }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>编排画布</h3>
        </div>
        <div className={styles.colBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div className={multiStyles.canvasWrap}>
            <div className={multiStyles.canvasArea}>
              {/* 开始节点 */}
              <div className={multiStyles.canvasStartNode}>
                ▶ 开始
              </div>

              {/* 连接线 */}
              <div className={multiStyles.canvasConnector} />
              <div className={multiStyles.canvasConnectorArrow} />

              {/* Agent 节点 */}
              <div className={multiStyles.canvasAgentNode}>
                <img src={agent.avatar} alt={agent.name} className={multiStyles.canvasAgentAvatar} />
                <div className={multiStyles.canvasAgentInfo}>
                  <span className={multiStyles.canvasAgentName}>{agent.name}</span>
                  <span className={multiStyles.canvasAgentRole}>主 Agent</span>
                </div>
              </div>

              {/* 子 Agent 节点 */}
              {subAgents.map((sub, index) => (
                <div
                  key={sub.id}
                  className={multiStyles.canvasAgentNode}
                  style={{
                    top: `${160 + index * 80}px`,
                    left: '240px',
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#506070',
                  }}>
                    {sub.name.charAt(0)}
                  </div>
                  <div className={multiStyles.canvasAgentInfo}>
                    <span className={multiStyles.canvasAgentName}>{sub.name}</span>
                    <span className={multiStyles.canvasAgentRole}>子 Agent</span>
                  </div>
                </div>
              ))}

              {subAgents.length === 0 && (
                <div className={multiStyles.canvasPlaceholder}>
                  从左侧面板添加子 Agent
                </div>
              )}
            </div>

            {/* 底部工具栏 */}
            <div className={multiStyles.canvasToolbar}>
              <div className={multiStyles.canvasToolbarLeft}>
                <button className={multiStyles.canvasToolBtn} onClick={handleAddAgent}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  添加节点
                </button>
                <button className={multiStyles.canvasToolBtn}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 8L6 10L9 8M3 6L6 8L9 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  撤销
                </button>
                <button className={multiStyles.canvasToolBtn}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M9 8L6 10L3 8M9 6L6 8L3 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  重做
                </button>
              </div>
              <div className={multiStyles.canvasToolbarRight}>
                <button className={multiStyles.canvasToolBtn} title="缩小">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8 8L11 11M3 5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
                <span style={{ fontSize: 12, color: '#8896a6', fontWeight: 500 }}>100%</span>
                <button className={multiStyles.canvasToolBtn} title="放大">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8 8L11 11M5 3V7M3 5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
                <button className={multiStyles.canvasToolBtn} title="全屏">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 4V1H4M8 1H11V4M11 8V11H8M4 11H1V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button className={multiStyles.canvasToolBtn} title="重置视图">
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

      {/* 右侧栏：预览与调试 */}
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
          <SelectModal
          visible={dialogFlow}
            title="添加对话流"
            emptyText="暂无对话流"
            createLabel="添加对话流"
            onClose={() => setDialogFlow(false)}
            onCreate={() =>navigate('/workflows') }
          />
          <SelectModal
            visible={database}
            title="添加知识库"
            emptyText="暂无知识库"
            createLabel="添加知识库"
            onClose={() => setDatabase(false)}
            onCreate={() =>navigate('/knowledge-bases/document') }
                    />
        </div>
      </div>
    </>
  )
}
