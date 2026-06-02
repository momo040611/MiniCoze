import React, { useEffect, useState, useMemo } from 'react'
import { knowledgeApi, type KnowledgeBase } from '../../../api/knowledge-base'
import styles from './DatabaseTags.module.css'

interface Props {
  ids: string[]
  onRemove: (id: string) => void
  onAdd: () => void
}

export function DatabaseTags({ ids, onRemove, onAdd }: Props) {
  const [allKbs, setAllKbs] = useState<KnowledgeBase[]>([])

  useEffect(() => {
    knowledgeApi.getKnowledgeBases().then((res) => setAllKbs(res.data.list)).catch(() => setAllKbs([]))
  }, [])

  const selectedKbs = useMemo(
    () => allKbs.filter((kb) => (ids ?? []).includes(kb.id)),
    [allKbs, ids],
  )

  return (
    <div className={styles.wrap}>
      {selectedKbs.map((kb) => (
        <span key={kb.id} className={styles.tag}>
          <span className={styles.tagIcon}>{kb.icon?.trim() || '📚'}</span>
          <span className={styles.tagName}>{kb.name}</span>
          <button
            className={styles.tagRemove}
            onClick={(e) => {
              e.stopPropagation()
              onRemove(kb.id)
            }}
          >
            ×
          </button>
        </span>
      ))}
      <button className={styles.tagAdd} onClick={onAdd}>
        +
      </button>
    </div>
  )
}
