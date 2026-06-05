import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWorkflowList, type Workflow } from '../../../api/workflows'
import styles from './WorkflowSelectModal.module.css'

interface Props {
  visible: boolean
  onClose: () => void
  onSelect: (wf: Workflow) => void
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  DRAFT: { text: '草稿', color: '#6b7280' },
  ACTIVE: { text: '已发布', color: '#22c55e' },
  ARCHIVED: { text: '已归档', color: '#8896a6' },
}

const WF_CATEGORIES = [
  { key: 'all', label: '全部工作流', icon: '⚡', count: 0 },
]

export function WorkflowSelectModal({ visible, onClose, onSelect }: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Workflow[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [sortBy, setSortBy] = useState('updated')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getWorkflowList()
      setItems(list)
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
      setSortBy('updated')
      setStatusFilter('all')
    }
  }, [visible, load])

  const categories = useMemo(
    () => WF_CATEGORIES.map((c) => ({ ...c, count: items.length })),
    [items],
  )

  const filtered = useMemo(() => {
    let list = items
    const value = search.trim().toLowerCase()
    if (value) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(value) ||
          (item.description && item.description.toLowerCase().includes(value)),
      )
    }
    if (statusFilter !== 'all') {
      list = list.filter((item) => (item.status ?? 'DRAFT') === statusFilter)
    }
    return list
  }, [items, search, statusFilter])

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
          <h2 className={styles.title}>添加工作流</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.main}>
          <div className={styles.sidebar}>
            <div className={styles.searchWrap}>
              <input
                className={styles.searchInput}
                placeholder="搜索工作流名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className={styles.createGroupBtn}
              onClick={() => { onClose(); navigate('/workflows') }}
            >
              创建工作流
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
              <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">全部状态</option>
                <option value="DRAFT">草稿</option>
                <option value="ACTIVE">已发布</option>
                <option value="ARCHIVED">已归档</option>
              </select>
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
                      <rect x="6" y="8" width="52" height="48" rx="6" stroke="#a0aec0" strokeWidth="1.8" />
                      <path d="M18 22H46M18 32H46M18 42H36" stroke="#a0aec0" strokeWidth="1.4" strokeLinecap="round" />
                      <circle cx="42" cy="44" r="10" stroke="#a0aec0" strokeWidth="1.4" />
                      <path d="M42 39V49M37 44H47" stroke="#a0aec0" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className={styles.emptyText}>
                    {search ? '未找到匹配的工作流' : '暂无工作流，点击下方按钮创建'}
                  </span>
                  {!search && (
                    <button
                      className={styles.emptyAction}
                      onClick={() => { onClose(); navigate('/workflows') }}
                    >
                      创建工作流
                    </button>
                  )}
                </div>
              ) : (
                sorted.map((item) => {
                  const statusInfo = STATUS_LABELS[item.status ?? 'DRAFT']
                  return (
                    <div
                      key={item.id}
                      className={styles.item}
                      onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                    >
                      <div className={styles.itemIcon}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 4H14M2 8H14M2 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{item.name}</span>
                        <div className={styles.itemMeta}>
                          <span style={{ color: statusInfo.color }}>{statusInfo.text}</span>
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
                  )
                })
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
