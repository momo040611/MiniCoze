import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { knowledgeApi, type KnowledgeBase } from '../../../api/knowledge-base'
import { StatusBadge } from '../../knowledge-base/components/StatusBadge'
import { KnowledgeIcon } from '../../knowledge-base/components/KnowledgeIcon'
import styles from './KnowledgeSelectModal.module.css'

interface Props {
  visible: boolean
  onClose: () => void
  onSelect: (kb: KnowledgeBase) => void
}

const KB_CATEGORIES = [
  { key: 'all', label: '资源库知识库', icon: '📚', count: 0 },
]

export function KnowledgeSelectModal({ visible, onClose, onSelect }: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<KnowledgeBase[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [sortBy, setSortBy] = useState('updated')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await knowledgeApi.getKnowledgeBases()
      setItems(response.data.list)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (visible) {
      load()
      setSearch('')
      setSelectedId(null)
      setCategory('all')
    }
  }, [visible, load])

  const categories = useMemo(
    () => KB_CATEGORIES.map((c) => ({ ...c, count: items.length })),
    [items],
  )

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(value) ||
        (item.description && item.description.toLowerCase().includes(value)),
    )
  }, [items, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [filtered, sortBy])

  const handleConfirm = () => {
    const selected = items.find((item) => item.id === selectedId)
    if (selected) {
      onSelect(selected)
      onClose()
    }
  }

  if (!visible) return null

  const isEmpty = !loading && sorted.length === 0

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>添加知识库</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.main}>
          <div className={styles.sidebar}>
            <div className={styles.searchWrap}>
              <input
                className={styles.searchInput}
                placeholder="搜索知识库名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className={styles.createGroupBtn}
              onClick={() => { onClose(); navigate('/knowledge/create') }}
            >
              创建知识库
            </button>

            <hr className={styles.sidebarDivider} />

            <span className={styles.sidebarLabel}>资源</span>
            <ul className={styles.categoryList}>
              {categories.map((c) => (
                <li
                  key={c.key}
                  className={`${styles.categoryItem} ${category === c.key ? styles.categoryItemActive : ''}`}
                  onClick={() => setCategory(c.key)}
                >
                  <span className={styles.categoryIcon}>{c.icon}</span>
                  <span>{c.label}</span>
                  <span className={styles.categoryCount}>{c.count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.content}>
            <div className={styles.toolbar}>
              <select className={styles.filterSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="updated">最近更新</option>
                <option value="name">名称排序</option>
              </select>
            </div>

            <div className={styles.listBody}>
              {loading ? (
                <div className={styles.loading}>加载中...</div>
              ) : isEmpty ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIllustration}>
                    <svg viewBox="0 0 64 64" fill="none">
                      <rect x="8" y="12" width="48" height="44" rx="6" stroke="#a0aec0" strokeWidth="1.8" />
                      <path d="M8 24H56" stroke="#a0aec0" strokeWidth="1.4" />
                      <circle cx="15" cy="19" r="2" fill="#a0aec0" />
                      <circle cx="22" cy="19" r="2" fill="#a0aec0" />
                      <circle cx="29" cy="19" r="2" fill="#a0aec0" />
                      <path d="M16 34H48M16 42H40M16 50H32" stroke="#a0aec0" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className={styles.emptyText}>
                    {search ? '未找到匹配的知识库' : '暂无知识库，点击下方按钮创建'}
                  </span>
                  {!search && (
                    <button
                      className={styles.emptyAction}
                      onClick={() => { onClose(); navigate('/knowledge/create') }}
                    >
                      创建知识库
                    </button>
                  )}
                </div>
              ) : (
                sorted.map((item) => (
                  <div
                    key={item.id}
                    className={styles.item}
                    onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                  >
                    <KnowledgeIcon value={item} size="card" />
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>{item.name}</span>
                      <div className={styles.itemMeta}>
                        <StatusBadge status={item.status} />
                        <span className={styles.itemMetaDot} />
                        <span>{item.documentCount} 文档</span>
                        {item.description && (
                          <>
                            <span className={styles.itemMetaDot} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                              {item.description}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {selectedId === item.id && (
                      <span className={styles.itemCheck}>✓</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button
            className={styles.confirmBtn}
            disabled={!selectedId}
            onClick={handleConfirm}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
