import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkflowList, type Workflow } from '../../../api/workflows';
import styles from './WorkflowSelectModal.module.css';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (wf: Workflow) => void;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '未发布',
  ACTIVE: '已发布',
  ARCHIVED: '已归档',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function WorkflowSelectModal({ visible, onClose, onSelect }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Workflow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('DRAFT');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getWorkflowList();
      setItems(list);
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
      setTypeFilter('all');
      setStatusFilter('DRAFT');
    }
  }, [visible, load]);

  const filtered = useMemo(() => {
    let list = items;
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(keyword) ||
          (item.description && item.description.toLowerCase().includes(keyword)),
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((item) => (item.status ?? 'DRAFT') === statusFilter);
    }
    return list;
  }, [items, search, statusFilter]);

  const handleSelect = (wf: Workflow) => {
    onSelect(wf);
    onClose();
  };

  const isEmpty = !loading && filtered.length === 0;

  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* 顶部标题栏 */}
        <div className={styles.header}>
          <h2 className={styles.title}>添加工流</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            &#x2715;
          </button>
        </div>

        {/* 主区域：左右两栏 */}
        <div className={styles.main}>
          {/* 左侧边栏 */}
          <div className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>添加工流</h3>

            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </span>
              <input
                className={styles.searchInput}
                placeholder="搜索"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className={styles.sidebarBtns}>
              <button
                className={styles.createWfBtn}
                onClick={() => {
                  onClose();
                  navigate('/workflows');
                }}
              >
                创建工作流
                <span className={styles.createWfBtnArrow}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M2 2.5L4 4.5L6 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
              <button className={styles.importBtn}>
                <span className={styles.importBtnIcon}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2V10M7 10L4 7M7 10L10 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M1.5 9.5V11.5H12.5V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
                导入
              </button>
            </div>

            <hr className={styles.sidebarDivider} />

            <ul className={styles.menuList}>
              <li className={`${styles.menuItem} ${styles.menuItemActive}`}>
                <span className={styles.menuIcon}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4H14M2 8H14M2 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span>资源库工作流</span>
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
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="all">类型：全部</option>
                <option value="workflow">工作流</option>
                <option value="chatflow">对话流</option>
              </select>
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ minWidth: 120 }}
              >
                <option value="all">状态：全部</option>
                <option value="DRAFT">状态：未发布</option>
                <option value="ACTIVE">状态：已发布</option>
              </select>
              <div className={styles.filterSpacer} />
              <button className={styles.addBtn}>添加</button>
            </div>

            {/* 工作流列表 / 空状态 */}
            {loading ? (
              <div className={styles.loading}>加载中...</div>
            ) : isEmpty ? (
              <div className={styles.emptyState}>
                <h4 className={styles.emptyTitle}>暂无工作流</h4>
                <p className={styles.emptyDesc}>请先创建后添加</p>
                <button
                  className={styles.emptyAction}
                  onClick={() => {
                    onClose();
                    navigate('/workflows');
                  }}
                >
                  创建工作流
                </button>
              </div>
            ) : (
              <div className={styles.listBody}>
                {filtered.map((wf) => {
                  const isSelected = selectedId === wf.id;
                  const status = wf.status ?? 'DRAFT';
                  const statusLabel = STATUS_LABELS[status] ?? status;

                  return (
                    <div
                      key={wf.id}
                      className={`${styles.wfCard} ${isSelected ? styles.wfCardSelected : ''}`}
                      onClick={() =>
                        setSelectedId(isSelected ? null : wf.id)
                      }
                    >
                      {/* 左侧：图标 + 信息 */}
                      <div className={styles.wfCardLeft}>
                        <div className={styles.wfIcon}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M2 4H14M2 8H14M2 12H10"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <div className={styles.wfInfo}>
                          <span className={styles.wfName}>{wf.name}</span>
                          <div className={styles.wfMeta}>
                            <span>{statusLabel}</span>
                            <span className={styles.wfMetaDot} />
                            <span>{formatDate(wf.updatedAt)}</span>
                            {wf.description && (
                              <>
                                <span className={styles.wfMetaDot} />
                                <span className={styles.wfDesc}>
                                  {wf.description}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 右侧：添加按钮 */}
                      <div className={styles.wfCardRight}>
                        <button
                          className={styles.wfAddBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(wf);
                          }}
                        >
                          添加
                        </button>
                      </div>

                      {/* 选中标记 */}
                      {isSelected && (
                        <span className={styles.selectedMark}>
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
            onClick={() => {
              const selected = items.find((item) => item.id === selectedId);
              if (selected) {
                onSelect(selected);
                onClose();
              }
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
