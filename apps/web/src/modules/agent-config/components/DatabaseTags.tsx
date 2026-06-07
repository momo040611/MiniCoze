import React, { useEffect, useState, useMemo } from 'react'
import { type KnowledgeBase } from '../../../api/knowledge-base'
import { KnowledgeStatus } from '../../../api/knowledge-base/types'
import { http, type ApiEnvelope } from '../../../api/http'
import { getCurrentWorkspaceId } from '../../../api/workspace'
import styles from './DatabaseTags.module.css'

/** 后端知识库响应 DTO */
interface BackendKnowledgeBase {
  id: string;
  workspaceId: string;
  creatorId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapKnowledgeBase(item: BackendKnowledgeBase): KnowledgeBase {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    status: item.enabled ? KnowledgeStatus.Active : KnowledgeStatus.Disabled,
    sourceType: 'local_file',
    documentCount: 0,
    chunkCount: 0,
    indexMode: 'high_quality' as const,
    chunkConfig: {
      chunkMode: 'general' as const,
      chunkSize: 500,
      chunkOverlap: 50,
      separator: '\n',
      autoClean: true,
    },
    embeddingConfig: {
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 1536,
      language: 'zh',
    },
    retrievalConfig: {
      retrievalMode: 'vector' as const,
      topK: 5,
      scoreThreshold: 0.5,
      rerankEnabled: false,
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

interface Props {
  ids: string[]
  onRemove: (id: string) => void
  onAdd: () => void
}

export function DatabaseTags({ ids, onRemove, onAdd }: Props) {
  const [allKbs, setAllKbs] = useState<KnowledgeBase[]>([])

  useEffect(() => {
    getCurrentWorkspaceId()
      .then((workspaceId) =>
        http.get<ApiEnvelope<BackendKnowledgeBase[]>>('knowledge/bases', {
          query: { workspaceId },
        }),
      )
      .then((res) => setAllKbs(res.data.map(mapKnowledgeBase)))
      .catch(() => setAllKbs([]))
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
