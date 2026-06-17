import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlugins, type IPlugin } from '../../../api/plugins';
import { getCurrentWorkspaceId } from '../../../api/workspace';
import styles from './AddPluginModal.module.css';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (plugins: IPlugin[]) => void;
  selectedIds?: string[];
}

const PLUGIN_TYPE_LABELS: Record<string, string> = {
  BUILTIN: '内置',
  HTTP: '三方',
};

function getPluginTypeLabel(plugin: IPlugin): string {
  return PLUGIN_TYPE_LABELS[plugin.type] ?? plugin.type;
}

export function AddPluginModal({ visible, onClose, onSelect, selectedIds: preSelectedIds }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [plugins, setPlugins] = useState<IPlugin[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState('all');
  const [sourceType, setSourceType] = useState('all');
  const [sortBy, setSortBy] = useState('popular');

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const workspaceId = await getCurrentWorkspaceId();
      const result = await getPlugins({ workspaceId, pageSize: 100 });
      setPlugins(result.list);
    } catch {
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadPlugins();
      setSearch('');
      setSelectedIds(new Set(preSelectedIds ?? []));
      setCategory('all');
      setSourceType('all');
      setSortBy('popular');
    }
  }, [visible, loadPlugins, preSelectedIds]);

  const filtered = useMemo(() => {
    let list = plugins;
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) ||
          p.description.toLowerCase().includes(keyword),
      );
    }
    if (sourceType === 'builtin') {
      list = list.filter((p) => p.isBuiltin);
    } else if (sourceType === 'thirdparty') {
      list = list.filter((p) => !p.isBuiltin);
    }
    return list;
  }, [plugins, search, sourceType]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'newest') {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    return list;
  }, [filtered, sortBy]);

  const toggleSelect = useCallback((pluginId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
  }, []);

  const handleConfirm = () => {
    const selected = plugins.filter((p) => selectedIds.has(p.id));
    onSelect(selected);
    onClose();
  };

  const categoryCount = plugins.length;

  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* 顶部标题栏 */}
        <div className={styles.header}>
          <h2 className={styles.title}>添加插件</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            &#x2715;
          </button>
        </div>

        {/* 主区域：左右两栏 */}
        <div className={styles.main}>
          {/* 左侧边栏 */}
          <div className={styles.sidebar}>
            <div className={styles.searchWrap}>
              <input
                className={styles.searchInput}
                placeholder="搜索"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className={styles.createPluginBtn}
              onClick={() => {
                onClose();
                navigate('/plugins');
              }}
            >
              创建插件
            </button>

            <hr className={styles.sidebarDivider} />

            {/* 资源库工具 + 收藏 */}
            <div className={styles.menuGroup}>
              <div
                className={`${styles.menuItem} ${category === 'library' ? styles.menuItemActive : ''}`}
                onClick={() => setCategory('library')}
              >
                <span className={styles.menuIcon}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect
                      x="1"
                      y="1"
                      width="6"
                      height="6"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <rect
                      x="9"
                      y="1"
                      width="6"
                      height="6"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <rect
                      x="1"
                      y="9"
                      width="6"
                      height="6"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <rect
                      x="9"
                      y="9"
                      width="6"
                      height="6"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                </span>
                <span>资源库工具</span>
                <span className={styles.menuCount}>{categoryCount}</span>
              </div>

              <div
                className={`${styles.menuItem} ${category === 'favorite' ? styles.menuItemActive : ''}`}
                onClick={() => setCategory('favorite')}
              >
                <span className={styles.menuIcon}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 1.5L10 5.5L14.5 6L11 9.5L12 14L8 11.5L4 14L5 9.5L1.5 6L6 5.5L8 1.5Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>收藏</span>
              </div>
            </div>

            {/* 探索工具分组 */}
            <div className={styles.menuGroup}>
              <span className={styles.menuGroupLabel}>探索工具</span>
              <div
                className={`${styles.menuItem} ${category === 'all' ? styles.menuItemActive : ''}`}
                onClick={() => setCategory('all')}
              >
                <span>全部</span>
              </div>
            </div>

            {/* 底部反馈 */}
            <div className={styles.sidebarFooter}>
              <span className={styles.sidebarFooterText}>
                没找到想要的插件？
              </span>{' '}
              <a className={styles.sidebarFooterLink} href="#feedback">
                提交反馈
              </a>
            </div>
          </div>

          {/* 右侧内容区 */}
          <div className={styles.content}>
            {/* 顶部筛选栏 */}
            <div className={styles.toolbar}>
              <select
                className={styles.filterSelect}
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
              >
                <option value="all">来源类型 全部</option>
                <option value="builtin">内置</option>
                <option value="thirdparty">三方</option>
              </select>
              <div className={styles.filterSpacer} />
              <select
                className={styles.filterSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="popular">排序 最受欢迎</option>
                <option value="newest">最新发布</option>
                <option value="name">名称排序</option>
              </select>
            </div>

            {/* 插件列表 */}
            <div className={styles.listBody}>
              {loading ? (
                <div className={styles.loading}>加载中...</div>
              ) : sorted.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect
                        x="4"
                        y="6"
                        width="40"
                        height="36"
                        rx="6"
                        stroke="#d1d5db"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M16 18h16M16 26h12"
                        stroke="#d1d5db"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="32"
                        cy="28"
                        r="8"
                        stroke="#d1d5db"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M32 24v8M28 28h8"
                        stroke="#d1d5db"
                        strokeWidth="1"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className={styles.emptyText}>
                    {search ? '未找到匹配的插件' : '暂无可用插件'}
                  </span>
                </div>
              ) : (
                sorted.map((plugin) => {
                  const isSelected = selectedIds.has(plugin.id);
                  const isBuiltin = plugin.isBuiltin;
                  const typeLabel = getPluginTypeLabel(plugin);
                  const toolCountLabel = `${plugin.toolCount} 个工具`;

                  return (
                    <div
                      key={plugin.id}
                      className={`${styles.pluginCard} ${isSelected ? styles.pluginCardSelected : ''}`}
                      onClick={() => toggleSelect(plugin.id)}
                    >
                      <div className={styles.pluginCardLeft}>
                        <div className={styles.pluginIcon}>
                          {plugin.iconUrl ? (
                            <img
                              src={plugin.iconUrl}
                              alt={plugin.name}
                              className={styles.pluginIcon}
                              style={{ objectFit: 'cover' }}
                            />
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

                        <div className={styles.pluginInfo}>
                          <div className={styles.pluginNameRow}>
                            <span
                              className={styles.pluginName}
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                navigate(`/plugins/${plugin.id}`);
                              }}
                              role="button"
                              tabIndex={0}
                            >
                              {plugin.name}
                            </span>
                            <span className={styles.tags}>
                              <span
                                className={`${styles.tag} ${isBuiltin ? styles.tagOfficial : styles.tagThirdParty}`}
                              >
                                {typeLabel}
                              </span>
                              <span className={`${styles.tag} ${styles.tagFree}`}>
                                免费
                              </span>
                              <span
                                className={`${styles.tag} ${styles.tagCategory}`}
                              >
                                工具
                              </span>
                            </span>
                          </div>
                          <div className={styles.pluginMeta}>
                            <span>{plugin.version}</span>
                            <span className={styles.pluginMetaDot} />
                            <span>{toolCountLabel}</span>
                            {plugin.credentialSummary?.activeCount ? (
                              <>
                                <span className={styles.pluginMetaDot} />
                                <span>
                                  {plugin.credentialSummary.activeCount} 凭证
                                </span>
                              </>
                            ) : null}
                          </div>
                          <span className={styles.pluginDesc}>
                            {plugin.description}
                          </span>
                        </div>
                      </div>

                      <div className={styles.pluginCardRight}>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>—</span>
                          <span className={styles.statLabel}>调用量</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>—</span>
                          <span className={styles.statLabel}>资源占用</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>—</span>
                          <span className={styles.statLabel}>耗时</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>—</span>
                          <span className={styles.statLabel}>可用率</span>
                        </div>
                        <button
                          type="button"
                          className={styles.arrowBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            navigate(`/plugins/${plugin.id}`);
                          }}
                          title="查看详情"
                        >
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
                        </button>
                      </div>

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
                })
              )}
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className={styles.footer}>
          {selectedIds.size > 0 && (
            <span className={styles.selectedCount}>
              已选择{' '}
              <span className={styles.selectedCountNum}>
                {selectedIds.size}
              </span>{' '}
              个插件
            </span>
          )}
          <button className={styles.cancelBtn} onClick={onClose}>
            取消
          </button>
          <button
            className={styles.confirmBtn}
            disabled={selectedIds.size === 0}
            onClick={handleConfirm}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
