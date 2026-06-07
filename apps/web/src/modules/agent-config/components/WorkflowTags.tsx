import React, { useEffect, useState, useMemo } from 'react'
import { getWorkflowListRemote, type Workflow } from '../../../api/workflows'
import { getCurrentWorkspaceId } from '../../../api/workspace'
import styles from './DatabaseTags.module.css'

interface Props {
  ids: string[]
  onRemove: (id: string) => void
  onAdd: () => void
}

export function WorkflowTags({ ids, onRemove, onAdd }: Props) {
  const [allItems, setAllItems] = useState<Workflow[]>([])

  useEffect(() => {
    getCurrentWorkspaceId()
      .then((workspaceId) => getWorkflowListRemote(workspaceId))
      .then(setAllItems)
      .catch(() => setAllItems([]))
  }, [])

  const selected = useMemo(
    () => allItems.filter((item) => (ids ?? []).includes(item.id)),
    [allItems, ids],
  )

  return (
    <div className={styles.wrap}>
      {selected.map((item) => (
        <span key={item.id} className={styles.tag}>
          <span className={styles.tagIcon}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M2 4H14M2 8H14M2 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.tagName}>{item.name}</span>
          <button
            className={styles.tagRemove}
            onClick={(e) => {
              e.stopPropagation()
              onRemove(item.id)
            }}
          >
            ×
          </button>
        </span>
      ))}
      <button className={styles.tagAdd} onClick={onAdd}>+</button>
    </div>
  )
}
