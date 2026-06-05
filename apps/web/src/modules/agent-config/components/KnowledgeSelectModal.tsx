import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { knowledgeApi, type KnowledgeBase } from '../../../api/knowledge-base';
import { KnowledgeStatus } from '../../../api/knowledge-base/types';
import styles from './KnowledgeSelectModal.module.css';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (kb: KnowledgeBase) => void;
  selectedIds?: string[];
  onRemove?: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  [KnowledgeStatus.Active]: '可用',
  [KnowledgeStatus.Indexing]: '索引中',
  [KnowledgeStatus.Disabled]: '已停用',
  [KnowledgeStatus.Failed]: '失败',
};

const STATUS_CLASSES: Record<string, string> = {
  [KnowledgeStatus.Active]: styles.tagActive,
  [KnowledgeStatus.Indexing]: styles.tagIndexing,
  [KnowledgeStatus.Disabled]: styles.tagDisabled,
  [KnowledgeStatus.Failed]: styles.tagFailed,
};

const SOURCE_LABELS: Record<string, string> = {
  local_file: '本地文件',
  text: '文本',
  url: '网页链接',
  notion: 'Notion',
  api_source: 'API',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function KnowledgeSelectModal({ visible, onClose, onSelect, selectedIds, onRemove }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<KnowledgeBase[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await knowledgeApi.getKnowledgeBases();
      setItems(response.data.list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      load();
      setSearch('');
      setSelectedId(null);
      setSourceFilter('all');
      setTimeFilter('all');
    }
  }, [visible, load]);

  const filtered = useMemo(() => {
    let list = items;
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(keyword) ||
          item.description.toLowerCase().includes(keyword),
      );
    }
    if (sourceFilter !== 'all') {
      list = list.filter((item) => item.sourceType === sourceFilter);
    }
    if (timeFilter === 'newest') {
      list = [...list].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (timeFilter === 'oldest') {
      list = [...list].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return list;
  }, [items, search, sourceFilter, timeFilter]);

  const handleConfirm = () => {
    const selected = items.find((item) => item.id === selectedId);
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  const isEmpty = !loading && filtered.length === 0;

  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* 顶部标题栏 */}
        <div className={styles.header}>
          <h2 className={styles.title}>选择知识库</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            &#x2715;
          </button>
        </div>

        {/* 主区域：左右两栏 */}
        <div className={styles.main}>
          {/* 左侧边栏 */}
          <div className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>选择知识库</h3>
            <div className={styles.searchWrap}>
              <input
                className={styles.searchInput}
                placeholder="搜索"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className={styles.createBtn}
              onClick={() => {
                onClose();
                navigate('/knowledge');
              }}
            >
              创建知识库
            </button>
            <hr className={styles.sidebarDivider} />
            <ul className={styles.menuList}>
              <li className={`${styles.menuItem} ${styles.menuItemActive}`}>
                <span className={styles.menuIcon}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                    <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </span>
                <span>资源库知识库</span>
                <span className={styles.menuCount}>{items.length}</span>
              </li>
            </ul>
          </div>

          {/* 右侧内容区 */}
          <div className={styles.content}>
            {/* 顶部筛选栏 */}
            <div className={styles.toolbar}>
              <select
                className={styles.filterSelect}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                style={{ minWidth: 130 }}
              >
                <option value="all">全部来源</option>
                <option value="local_file">本地文件</option>
                <option value="text">文本</option>
                <option value="url">网页链接</option>
              </select>
              <select
                className={styles.filterSelect}
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                style={{ minWidth: 130 }}
              >
                <option value="all">创建时间</option>
                <option value="newest">最新创建</option>
                <option value="oldest">最早创建</option>
              </select>
            </div>

            {/* 知识库列表 / 空状态 */}
            {loading ? (
              <div className={styles.loading}>加载中...</div>
            ) : isEmpty ? (
              <div className={styles.emptyState}>
                <h4 className={styles.emptyTitle}>暂无知识库</h4>
                <p className={styles.emptyDesc}>请先创建后添加</p>
                <button
                  className={styles.emptyAction}
                  onClick={() => {
                    onClose();
                    navigate('/knowledge');
                  }}
                >
                  创建知识库
                </button>
              </div>
            ) : (
              <div className={styles.listBody}>
                {filtered.map((kb) => {
                  const isSelected = selectedId === kb.id;
                  const isAlreadyAdded = (selectedIds ?? []).includes(kb.id);
                  const statusLabel = STATUS_LABELS[kb.status] ?? kb.status;
                  const statusClass =
                    STATUS_CLASSES[kb.status] ?? styles.tagDisabled;
                  const sourceLabel =
                    SOURCE_LABELS[kb.sourceType] ?? kb.sourceType;

                  return (
                    <div
                      key={kb.id}
                      className={`${styles.kbCard} ${isSelected ? styles.kbCardSelected : ''} ${isAlreadyAdded ? styles.kbCardAdded : ''}`}
                      onClick={() => {
                        if (isAlreadyAdded) {
                          onRemove?.(kb.id);
                          return;
                        }
                        setSelectedId(kb.id);
                      }}
                    >
                      {/* 左侧：图标 + 信息 */}
                      <div className={styles.kbCardLeft}>
                        <div className={styles.kbIcon}>
                          {kb.iconType === 'image' && kb.iconImageUrl ? (
                            <img src={kb.iconImageUrl} alt={kb.name} />
                          ) : kb.iconType === 'emoji' && kb.icon ? (
                            <span className={styles.kbEmoji}>{kb.icon}</span>
                          ) : (
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 20 20"
                              fill="none"
                            >
                              <rect
                                x="2"
                                y="2"
                                width="16"
                                height="16"
                                rx="4"
                                stroke="currentColor"
                                strokeWidth="1.2"
                              />
                              <path
                                d="M6 10h8M10 6v8"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </div>
                        <div className={styles.kbInfo}>
                          <div className={styles.kbNameRow}>
                            <span className={styles.kbName}>{kb.name}</span>
                            <span className={styles.tags}>
                              <span className={`${styles.tag} ${statusClass}`}>
                                {statusLabel}
                              </span>
                              <span className={`${styles.tag} ${styles.tagSource}`}>
                                {sourceLabel}
                              </span>
                            </span>
                          </div>
                          <div className={styles.kbMeta}>
                            <span>{kb.documentCount} 个文档</span>
                            <span className={styles.kbMetaDot} />
                            <span>{kb.chunkCount} 个片段</span>
                            {kb.owner && (
                              <>
                                <span className={styles.kbMetaDot} />
                                <span>{kb.owner}</span>
                              </>
                            )}
                            <span className={styles.kbMetaDot} />
                            <span>{formatDate(kb.updatedAt)}</span>
                          </div>
                          <span className={styles.kbDesc}>
                            {kb.description || '暂无描述'}
                          </span>
                        </div>
                      </div>

                      {/* 右侧：数据栏 + 箭头 */}
                      <div className={styles.kbCardRight}>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>
                            {kb.documentCount}
                          </span>
                          <span className={styles.statLabel}>文档数</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>
                            {kb.chunkCount}
                          </span>
                          <span className={styles.statLabel}>片段数</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>
                            {kb.indexStatus === 'ready'
                              ? '就绪'
                              : kb.indexStatus === 'indexing'
                                ? '索引中'
                                : '—'}
                          </span>
                          <span className={styles.statLabel}>索引状态</span>
                        </div>
                        <span className={styles.arrowBtn}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <path
                              d="M6 3L11 8L6 13"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </div>

                      {/* 选中标记 / 已添加标记 */}
                      {(isSelected || isAlreadyAdded) && (
                        <span className={`${styles.selectedMark} ${isAlreadyAdded ? styles.selectedMarkAdded : ''}`}>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2.5 6L5 8.5L9.5 3.5"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            取消
          </button>
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
  );
}
