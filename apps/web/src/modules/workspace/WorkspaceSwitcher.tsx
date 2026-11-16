// 工作区切换面板 — 带搜索和快捷操作
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as AntApp, Form, Input, Modal, Popover, Button, Avatar, Empty } from 'antd';
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
import { createWorkspace } from '../../api/workspace';
import type { WorkspaceInfo } from '../../api/workspace';
import styles from './WorkspaceSwitcher.module.css';

const ROLE_LABELS: Record<string, string> = {
  OWNER: '所有者',
  ADMIN: '管理员',
  MEMBER: '成员',
};

export function WorkspaceSwitcher() {
  const nav = useNavigate();
  const { message } = AntApp.useApp();
  const { workspaces, currentWorkspace, loading, switchWorkspace, refreshWorkspaces } =
    useWorkspace();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<{ name: string; description?: string }>();

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

  // 创建工作区：弹出表单，成功后刷新列表并切换到新工作区
  const handleCreate = useCallback(() => {
    setOpen(false);
    setSearch('');
    setCreateOpen(true);
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const created = await createWorkspace({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
      });
      message.success(`工作区「${created.name}」创建成功`);
      setCreateOpen(false);
      createForm.resetFields();
      await refreshWorkspaces();
      await switchWorkspace(created.id);
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(err instanceof Error ? err.message : '创建工作区失败');
    } finally {
      setCreating(false);
    }
  }, [createForm, message, refreshWorkspaces, switchWorkspace]);

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

      <Modal
        title="创建工作区"
        open={createOpen}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        onOk={() => void handleCreateSubmit()}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="工作区名称"
            rules={[
              { required: true, message: '请输入工作区名称' },
              { max: 50, message: '名称不能超过 50 个字符' },
            ]}
          >
            <Input placeholder="例如：产品团队" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={200} placeholder="工作区用途说明（可选）" />
          </Form.Item>
        </Form>
      </Modal>
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
