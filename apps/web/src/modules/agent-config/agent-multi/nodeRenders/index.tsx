import { useState, type ReactNode } from 'react'
import { Field } from '@flowgram.ai/free-layout-editor'
import type { ModelOption } from '../../../../api/agent-config/model-options'
import styles from './multiNodeRenderers.module.css'

/**
 * 节点内的输入控件必须拦住指针事件的冒泡，否则按下就会触发 Flowgram 的节点拖拽。
 * 另外 Flowgram 会在 pointerdown 之后 preventDefault，进而抑制兼容鼠标事件（含 click），
 * 所以节点内的按钮/开关一律用 onPointerDown 触发，不要用 onClick。
 */
function stopDrag(event: React.PointerEvent) {
  event.stopPropagation()
}

function ArrowRight() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3.5 2.5L6.5 5L3.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M3 1.5L10 6L3 10.5V1.5Z" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <circle cx="3" cy="6" r="1.2" />
      <circle cx="6" cy="6" r="1.2" />
      <circle cx="9" cy="6" r="1.2" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <circle cx="5" cy="5" r="4.3" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <path d="M4.5 7.5h1M5 4.5V3a1.5 1.5 0 011.5 1.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function ModelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1L10 3.5V8.5L6 11L2 8.5V3.5L6 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

function CollapsiblePanel({
  title,
  extra,
  defaultOpen = false,
  children,
}: {
  title: string
  extra?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={styles.panel}>
      <div
        className={styles.panelHeader}
        onPointerDown={(event) => {
          event.stopPropagation()
          setOpen((prev) => !prev)
        }}
      >
        <span className={`${styles.panelArrow} ${open ? styles.panelArrowOpen : ''}`}>
          <ArrowRight />
        </span>
        <span className={styles.panelTitle}>{title}</span>
        {extra}
      </div>
      {open && <div className={styles.panelContent}>{children}</div>}
    </div>
  )
}

function InlineTextarea({ name, placeholder }: { name: 'useCase' | 'prompt'; placeholder: string }) {
  return (
    <Field<string> name={name}>
      {({ field }) => (
        <textarea
          className={styles.inlineTextarea}
          value={field.value ?? ''}
          placeholder={placeholder}
          rows={3}
          onPointerDown={stopDrag}
          onChange={(event) => {
            field.onChange(event.target.value)
          }}
        />
      )}
    </Field>
  )
}

function ModelField({ modelOptions }: { modelOptions: ModelOption[] }) {
  return (
    <div className={styles.modelSelectWrap}>
      <span className={styles.modelSelectIcon}>
        <ModelIcon />
      </span>
      <Field<string> name="modelName">
        {({ field }) => (
          <select
            className={styles.modelSelect}
            value={field.value ?? ''}
            onPointerDown={stopDrag}
            onChange={(event) => {
              field.onChange(event.target.value)
            }}
          >
            <option value="">默认模型</option>
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </Field>
    </div>
  )
}

/** 字符串数组字段的通用编辑器：标签可删除，底部输入框回车新增 */
function TagListField({
  name,
  placeholder,
  emptyHint,
}: {
  name: 'skills' | 'suggestions'
  placeholder: string
  emptyHint: string
}) {
  const [draft, setDraft] = useState('')

  return (
    <Field<string[]> name={name}>
      {({ field }) => {
        const items = field.value ?? []

        const addDraft = () => {
          const next = draft.trim()
          if (!next || items.includes(next)) {
            setDraft('')
            return
          }
          field.onChange([...items, next])
          setDraft('')
        }

        return (
          <>
            {items.length === 0 ? (
              <div className={styles.emptyHint}>{emptyHint}</div>
            ) : (
              <div className={styles.skillTagList}>
                {items.map((item, index) => (
                  <span key={`${item}-${index}`} className={styles.skillTag}>
                    {item}
                    <button
                      type="button"
                      className={styles.tagRemove}
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        field.onChange(items.filter((_, itemIndex) => itemIndex !== index))
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              className={styles.inlineInput}
              value={draft}
              placeholder={placeholder}
              onPointerDown={stopDrag}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addDraft()
                }
              }}
              onBlur={addDraft}
            />
          </>
        )
      }}
    </Field>
  )
}

function AgentCardHeader({ type }: { type: string }) {
  const defaultSubtitle = type === 'agent' ? '主控 Agent' : '子 Agent'

  return (
    <div className={styles.cardHeader}>
      <div className={styles.headerGradientIcon}>
        <Field<string> name="label">
          {({ field }) => <>{field.value?.charAt(0) || 'A'}</>}
        </Field>
      </div>
      <div className={styles.headerInfo}>
        <Field<string> name="label">
          {({ field }) => (
            <input
              className={styles.headerName}
              value={field.value ?? ''}
              placeholder="未命名节点"
              onPointerDown={stopDrag}
              onChange={(event) => {
                field.onChange(event.target.value)
              }}
            />
          )}
        </Field>
        <Field<string> name="subtitle">
          {({ field }) => (
            <span className={styles.headerSub}>{field.value || defaultSubtitle}</span>
          )}
        </Field>
      </div>
      <div className={styles.headerActions}>
        <button className={`${styles.headerActionBtn} ${styles.playBtn}`} onPointerDown={stopDrag}>
          <PlayIcon />
        </button>
        <button className={styles.headerActionBtn} onPointerDown={stopDrag}>
          <MoreIcon />
        </button>
      </div>
    </div>
  )
}

function AgentNodeCard({ type, modelOptions }: { type: string; modelOptions: ModelOption[] }) {
  return (
    <div className={styles.agentCard}>
      <AgentCardHeader type={type} />

      <div className={styles.panelList}>
        <CollapsiblePanel title="模型设置" defaultOpen>
          <ModelField modelOptions={modelOptions} />
        </CollapsiblePanel>

        <CollapsiblePanel
          title="适用场景"
          extra={
            <>
              <span className={styles.panelTitleRequired}>*</span>
              <span className={styles.panelTitleHelp} title="必填项">
                <HelpIcon />
              </span>
            </>
          }
        >
          <InlineTextarea name="useCase" placeholder="描述这个 Agent 适合处理什么任务" />
        </CollapsiblePanel>

        <CollapsiblePanel title="Agent 提示词">
          <InlineTextarea name="prompt" placeholder="设定这个 Agent 的角色与行为" />
        </CollapsiblePanel>

        <CollapsiblePanel title="技能">
          <TagListField name="skills" placeholder="+ 添加技能，回车确认" emptyHint="暂无技能" />
        </CollapsiblePanel>

        <CollapsiblePanel title="用户问题建议" defaultOpen>
          <div className={styles.suggestionHint}>
            在智能体回复后，自动根据对话内容提供建议问题，引导用户继续提问。
          </div>
          <TagListField name="suggestions" placeholder="+ 添加建议，回车确认" emptyHint="暂无建议问题" />
        </CollapsiblePanel>
      </div>
    </div>
  )
}

function StartNodeCard() {
  return (
    <div className={styles.startNode}>
      <span className={styles.startIcon}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M3 1.5L12 7L3 12.5V1.5Z" />
        </svg>
      </span>
      <Field<string> name="label">
        {({ field }) => <span>{field.value || '开始'}</span>}
      </Field>
    </div>
  )
}

/** Flowgram 节点内容入口：按节点类型分发 */
export function MultiNodeCard({ type, modelOptions }: { type: string; modelOptions: ModelOption[] }) {
  if (type === 'start') {
    return <StartNodeCard />
  }

  return <AgentNodeCard type={type} modelOptions={modelOptions} />
}