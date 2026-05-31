import React from 'react'
import indexStyles from '../index.module.css'

interface Props {
  visible: boolean
  title: string
  emptyText: string
  createLabel: string
  onClose: () => void
  onCreate: () => void
  children?: React.ReactNode
}

export function SelectModal({ visible, title, emptyText, createLabel, onClose, onCreate, children }: Props) {
  if (!visible) return null

  return (
    <div className={indexStyles.modalOverlay} onClick={onClose}>
      <div className={indexStyles.modalDialog} onClick={(e) => e.stopPropagation()}>
        <div className={indexStyles.modalHeader}>
          <h2 className={indexStyles.modalTitle}>{title}</h2>
          <button className={indexStyles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={indexStyles.modalBody}>
          {children ?? (
            <p style={{ color: '#8896a6', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
              {emptyText}
            </p>
          )}
        </div>
        <div className={indexStyles.modalFooter}>
          <button className={indexStyles.modalCancelBtn} onClick={onClose}>取消</button>
          <button className={indexStyles.modalCreateBtn} onClick={onCreate}>{createLabel}</button>
        </div>
      </div>
    </div>
  )
}
