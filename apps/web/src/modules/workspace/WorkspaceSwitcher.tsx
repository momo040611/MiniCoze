// 工作区切换面板 — 带搜索和快捷操作
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popover, Input, Button, Avatar, Empty } from 'antd';
import {
  DownOutlined,
  PlusOutlined,
  CheckOutlined,
  TeamOutlined,
  CrownOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useWorkspace } from './use-workspace';
import type { WorkspaceInfo } from '../../api/workspace';
import styles from './WorkspaceSwitcher.module.css';

const ROLE_LABELS: Record<string, string> = {
  OWNER: '所有者',
  ADMIN: '管理员',
  MEMBER: '成员',
};

export function WorkspaceSwitcher() {
  const nav = useNavigate();
  const { workspaces, currentWorkspace, loading, switchWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // 过滤工作区
  const filteredWorkspaces = useMemo(() => {
    if (!search.trim()) return workspaces;
    const keyword = search.trim().toLowerCase();
    return workspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(keyword) ||
        (w.description?.toLowerCase().includes(keyword) ?? false),
    );
  }, [workspaces, search]);

  // 切换工作区
  const handleSwitch = useCallback(
    async (workspaceId: string) => {
      if (workspaceId === currentWorkspace?.id) return;
      await switchWorkspace(workspaceId);
      setOpen(false);
      setSearch('');
    },
    [currentWorkspace, switchWorkspace],
  );

  // 创建工作区
  const handleCreate = useCallback(() => {
    setOpen(false);
    setSearch('');
    // TODO: 打开创建工作区弹窗
    nav('/workspace/settings');
  }, [nav]);

  // 工作区设置
  const handleSettings = useCallback(() => {
    setOpen(false);
    nav('/workspace/settings');
  }, [nav]);

  // 渲染内容
  const content = (
    <div className={styles.panel}>
      {/* 搜索框 */}
      <div className={styles.searchWrap}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索工作区..."
          allowClear
          className={styles.searchInput}
          autoFocus
        />
      </div>

      {/* 工作区列表 */}
      <div className={styles.list}>
        {filteredWorkspaces.length === 0 ? (
          <Empty
            description={search ? '未找到匹配的工作区' : '暂无工作区'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            className={styles.empty}
          />
        ) : (
          filteredWorkspaces.map((workspace) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              isActive={workspace.id === currentWorkspace?.id}
              onSelect={handleSwitch}
              onSettings={handleSettings}
            />
          ))
        )}
      </div>

      {/* 底部操作 */}
      <div className={styles.footer}>
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          className={styles.createBtn}
        >
          创建新工作区
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayClassName={styles.popover}
      arrow={false}
    >
      <button className={styles.trigger} type="button">
        <span className={styles.triggerText}>
          {loading ? '加载中...' : currentWorkspace?.name ?? '选择工作区'}
        </span>
        <DownOutlined className={styles.triggerArrow} />
      </button>
    </Popover>
  );
}

// ══════════════════════════════════════════════
// 工作区列表项
// ══════════════════════════════════════════════

interface WorkspaceItemProps {
  workspace: WorkspaceInfo;
  isActive: boolean;
  onSelect: (id: string) => void;
  onSettings: () => void;
}

function WorkspaceItem({ workspace, isActive, onSelect, onSettings }: WorkspaceItemProps) {
  const handleClick = useCallback(() => {
    onSelect(workspace.id);
  }, [workspace.id, onSelect]);

  const handleSettingsClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSettings();
    },
    [onSettings],
  );

  return (
    <div
      className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <Avatar
        size={36}
        icon={<UserOutlined />}
        className={styles.itemAvatar}
      />
      <div className={styles.itemInfo}>
        <span className={styles.itemName}>
          {workspace.name}
          {isActive && <CheckOutlined className={styles.itemCheck} />}
        </span>
        <span className={styles.itemMeta}>
          {ROLE_LABELS[workspace.role ?? ''] ?? workspace.role ?? '成员'}
          {workspace.description && ` · ${workspace.description}`}
        </span>
      </div>
      {isActive && (
        <button
          className={styles.itemSettings}
          onClick={handleSettingsClick}
          title="工作区设置"
        >
          <SettingOutlined />
        </button>
      )}
    </div>
  );
}
