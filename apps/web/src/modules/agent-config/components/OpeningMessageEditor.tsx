import React, { useState, useRef, useCallback } from 'react'
import type { OpeningConfig } from '../agent-detail'
import styles from './OpeningMessageEditor.module.css'

interface Props {
  agentName: string
  config: OpeningConfig
  onChange: (config: OpeningConfig) => void
  defaultOpen?: boolean
}

const MAX_LENGTH = 1000

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className={styles.tooltipWrap}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && <span className={styles.tooltip}>{text}</span>}
    </span>
  )
}

export function OpeningMessageEditor({ agentName, config, onChange, defaultOpen = false }: Props) {
  const [expanded, setExpanded] = useState(defaultOpen)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [newQuestion, setNewQuestion] = useState('')
  const [hover, setHover] = useState(false)

  const { openingMessage, openingQuestions = [], openingQuestionsEnabled = false } = config

  const updateOpening = useCallback(
    (patch: Partial<OpeningConfig>) => onChange({ ...config, ...patch }),
    [config, onChange],
  )

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value
      if (val.length <= MAX_LENGTH) {
        updateOpening({ openingMessage: val })
      }
    },
    [updateOpening],
  )

  // Auto-save on blur
  const handleBlur = useCallback(() => {
    if (openingMessage && openingMessage.length > MAX_LENGTH) {
      updateOpening({ openingMessage: openingMessage.slice(0, MAX_LENGTH) })
    }
  }, [openingMessage, updateOpening])

  const insertFormatting = useCallback(
    (wrapper: (sel: string) => string) => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = ta.value.substring(start, end)
      const replacement = wrapper(selected || '')
      const newText = ta.value.substring(0, start) + replacement + ta.value.substring(end)
      if (newText.length > MAX_LENGTH) return
      updateOpening({ openingMessage: newText })
      requestAnimationFrame(() => {
        ta.focus()
        const cursor = start + replacement.length
        ta.setSelectionRange(cursor, cursor)
      })
    },
    [updateOpening],
  )

  const handleAddQuestion = useCallback(() => {
    const q = newQuestion.trim()
    if (!q) return
    updateOpening({ openingQuestions: [...openingQuestions, q] })
    setNewQuestion('')
  }, [newQuestion, openingQuestions, updateOpening])

  const handleRemoveQuestion = useCallback(
    (index: number) => {
      updateOpening({ openingQuestions: openingQuestions.filter((_, i) => i !== index) })
    },
    [openingQuestions, updateOpening],
  )

  const overLimit = openingMessage.length > MAX_LENGTH
  const previewText = openingMessage
    ? openingMessage.length > 40
      ? openingMessage.slice(0, 40) + '...'
      : openingMessage
    : ''

  return (
    <div
      className={`${styles.panel} ${expanded ? styles.panelExpanded : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* 标题栏 */}
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <span className={styles.headerTitle}>开场白</span>
        <div className={styles.headerRight}>
          {!expanded && previewText && (
            <span className={styles.headerPreview}>{previewText}</span>
          )}
          <button
            className={`${styles.editBtn} ${hover || expanded ? styles.editBtnVisible : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(true)
            }}
            title="编辑开场白"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10.5V12H3.5L10.35 5.15L8.85 3.65L2 10.5Z" fill="currentColor" />
              <path d="M11.5 2.5L11.3 2.3C11.1 2.1 10.9 2 10.7 2C10.5 2 10.3 2.1 10.1 2.3L9.15 3.25L10.75 4.85L11.7 3.9C12.1 3.5 12.1 2.9 11.7 2.5H11.5Z" fill="currentColor" />
            </svg>
          </button>
          <span className={`${styles.headerArrow} ${expanded ? styles.headerArrowOpen : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className={styles.body}>
          {/* 说明文字 */}
          <div className={styles.descRow}>
            <span className={styles.descText}>
              设置智能体的开场白，用户进入对话时会自动发送。
            </span>
            <Tooltip text="开场白将作为智能体在新对话中的第一条消息发送，引导用户开始对话。">
              <span className={styles.helpIcon}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7 10V6.5M7 4.5V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </span>
            </Tooltip>
          </div>

          {/* 编辑器容器 */}
          <div className={`${styles.editorWrap} ${overLimit ? styles.editorWrapOver : ''}`}>
            {/* 工具栏 */}
            <div className={styles.toolbar}>
              <button
                className={styles.toolbarBtn}
                title="加粗"
                onClick={() => insertFormatting((s) => `**${s || '加粗文本'}**`)}
              >
                <span style={{ fontWeight: 700 }}>B</span>
              </button>
              <button
                className={styles.toolbarBtn}
                title="斜体"
                onClick={() => insertFormatting((s) => `*${s || '斜体文本'}*`)}
              >
                <span style={{ fontStyle: 'italic' }}>I</span>
              </button>
              <button
                className={styles.toolbarBtn}
                title="下划线"
                onClick={() => insertFormatting((s) => `<u>${s || '下划线文本'}</u>`)}
              >
                <span style={{ textDecoration: 'underline' }}>U</span>
              </button>
              <span className={styles.toolbarDivider} />
              <button
                className={styles.toolbarBtn}
                title="无序列表"
                onClick={() => insertFormatting((s) => `\n- ${s || '列表项'}`)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <line x1="3" y1="4" x2="11" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="3" y1="10" x2="11" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <circle cx="1.5" cy="4" r="0.8" fill="currentColor" />
                  <circle cx="1.5" cy="7" r="0.8" fill="currentColor" />
                  <circle cx="1.5" cy="10" r="0.8" fill="currentColor" />
                </svg>
              </button>
              <button
                className={styles.toolbarBtn}
                title="有序列表"
                onClick={() => insertFormatting((s) => `\n1. ${s || '列表项'}`)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <line x1="4" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="4" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <line x1="4" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <text x="1" y="6" fill="currentColor" fontSize="7" fontWeight="600">1</text>
                  <text x="1" y="9" fill="currentColor" fontSize="7" fontWeight="600">2</text>
                  <text x="1" y="12" fill="currentColor" fontSize="7" fontWeight="600">3</text>
                </svg>
              </button>
              <span className={styles.toolbarDivider} />
              <button
                className={styles.toolbarBtn}
                title="插入表情"
                onClick={() => insertFormatting((s) => `😊${s}`)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="5" cy="5.5" r="0.7" fill="currentColor" />
                  <circle cx="9" cy="5.5" r="0.7" fill="currentColor" />
                  <path d="M4.5 8.5C5.5 10 8.5 10 9.5 8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
              </button>
              <button
                className={styles.toolbarBtn}
                title="插入链接"
                onClick={() => insertFormatting((s) => `[${s || '链接文本'}](url)`)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M6 8L8 6M4.5 9.5L3 8C1.6 6.6 1.6 4.3 3 2.9C4.4 1.5 6.7 1.5 8.1 2.9L9.6 4.4M9.5 4.5L11 6C12.4 7.4 12.4 9.7 11 11.1C9.6 12.5 7.3 12.5 5.9 11.1L4.4 9.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                className={styles.toolbarBtn}
                title="插入代码"
                onClick={() => insertFormatting((s) => `\`\`\`\n${s || 'code'}\n\`\`\``)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <polyline points="9.5,3 5,11 4,11" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  <polyline points="4,4 1.5,7 4,10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <polyline points="10,4 12.5,7 10,10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
              <button
                className={styles.toolbarBtn}
                title="插入变量"
                onClick={() => insertFormatting((s) => `{${s || '变量名'}}`)}
              >
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{'{ }'}</span>
              </button>
            </div>

            {/* 文本编辑区 */}
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder={`例如：你好！我是${agentName}，有什么可以帮你的吗？`}
              value={openingMessage}
              onChange={handleTextChange}
              onBlur={handleBlur}
              rows={8}
            />

            {/* 底部字数统计 */}
            <div className={`${styles.charCount} ${overLimit ? styles.charCountOver : ''}`}>
              {openingMessage.length}/{MAX_LENGTH}
              {overLimit && <span className={styles.charLimitHint}>超出最大字数限制</span>}
            </div>
          </div>

          {/* 开场白预置问题 */}
          <div className={styles.questionsSection}>
            <div className={styles.questionsHeader}>
              <span className={styles.questionsTitle}>开场白预置问题</span>
              <label className={styles.toggleWrap}>
                <span className={styles.toggleLabel}>全部显示</span>
                <span className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={openingQuestionsEnabled}
                    onChange={(e) => updateOpening({ openingQuestionsEnabled: e.target.checked })}
                  />
                  <span className={styles.toggleSlider} />
                </span>
              </label>
            </div>

            <div className={styles.questionsInputRow}>
              <input
                className={styles.questionsInput}
                placeholder="输入开场白引导问题"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddQuestion()
                }}
              />
              <button className={styles.questionsAddBtn} onClick={handleAddQuestion}>
                + 添加
              </button>
            </div>

            {openingQuestions.length > 0 && (
              <div className={styles.questionsList}>
                {openingQuestions.map((q, i) => (
                  <div key={i} className={styles.questionTag}>
                    <span className={styles.questionText}>{q}</span>
                    <button
                      className={styles.questionRemove}
                      onClick={() => handleRemoveQuestion(i)}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {openingQuestions.length > 0 && (
              <div className={styles.questionsPreviewHint}>
                预览效果：
                {openingQuestionsEnabled && (
                  <span className={styles.previewBtns}>
                    {openingQuestions.map((q, i) => (
                      <span key={i} className={styles.previewBtnSample}>{q}</span>
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
