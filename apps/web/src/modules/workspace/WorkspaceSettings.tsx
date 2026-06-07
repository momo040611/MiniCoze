// 工作区设置页 — 基本信息 + 成员管理
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Input,
  Button,
  message,
  Modal,
  Avatar,
  Select,
  Empty,
  Skeleton,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  TeamOutlined,
  PlusOutlined,
  DeleteOutlined,
  CrownOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useWorkspace } from './use-workspace';
import { getMembers, addMember, updateMemberRole, removeMember } from '../../api/workspace/members';
import type { WorkspaceMember } from '../../api/workspace/members';
import { http, type ApiEnvelope } from '../../api/http';
import styles from './WorkspaceSettings.module.css';

// ══════════════════════════════════════════════
// 角色配置
// ══════════════════════════════════════════════

const ROLE_OPTIONS = [
  { value: 'OWNER', label: '所有者', icon: <CrownOutlined /> },
  { value: 'ADMIN', label: '管理员', icon: <UserOutlined /> },
  { value: 'MEMBER', label: '成员', icon: <UserOutlined /> },
];

// ══════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════

export function WorkspaceSettings() {
  const nav = useNavigate();
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();

  // 基本信息状态
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // 成员管理状态
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // 初始化
  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name);
      setDescription(currentWorkspace.description ?? '');
    }
  }, [currentWorkspace]);

  // 加载成员列表
  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const list = await getMembers();
      setMembers(list);
    } catch (err) {
      console.error(err);
      message.error('加载成员列表失败');
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // 保存基本信息
  const handleSave = useCallback(async () => {
    if (!currentWorkspace || !name.trim()) return;
    setSaving(true);
    try {
      await http.patch<ApiEnvelope<void>>(
        `workspaces/${currentWorkspace.id}`,
        { name: name.trim(), description: description.trim() || undefined },
      );
      message.success('保存成功');
      await refreshWorkspaces();
    } catch (err) {
      console.error(err);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [currentWorkspace, name, description, refreshWorkspaces]);

  // 邀请成员
  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await addMember(inviteEmail.trim());
      message.success('成员添加成功');
      setInviteEmail('');
      setInviteModalOpen(false);
      await loadMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '添加失败';
      message.error(msg);
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, loadMembers]);

  // 修改成员角色
  const handleRoleChange = useCallback(async (userId: string, role: string) => {
    try {
      await updateMemberRole(userId, role as 'OWNER' | 'ADMIN' | 'MEMBER');
      message.success('角色更新成功');
      await loadMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '更新失败';
      message.error(msg);
    }
  }, [loadMembers]);

  // 移除成员
  const handleRemove = useCallback(async (userId: string) => {
    try {
      await removeMember(userId);
      message.success('成员已移除');
      await loadMembers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '移除失败';
      message.error(msg);
    }
  }, [loadMembers]);

  // 删除工作区
  const handleDelete = useCallback(async () => {
    if (!currentWorkspace) return;
    try {
      await http.delete(`workspaces/${currentWorkspace.id}`);
      message.success('工作区已删除');
      await refreshWorkspaces();
      nav('/workspace');
    } catch (err) {
      console.error(err);
      message.error('删除失败');
    }
  }, [currentWorkspace, refreshWorkspaces, nav]);

  const isOwner = currentWorkspace?.role === 'OWNER';

  return (
    <div className={styles.page}>
      {/* 页头 */}
      <div className={styles.header}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => nav('/workspace')}
          className={styles.backBtn}
        >
          返回工作台
        </Button>
        <h1 className={styles.title}>工作区设置</h1>
      </div>

      {/* 基本信息 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>基本信息</h2>
        <div className={styles.form}>
          <div className={styles.formItem}>
            <label className={styles.label}>工作区名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入工作区名称"
              maxLength={50}
              disabled={!isOwner}
            />
          </div>
          <div className={styles.formItem}>
            <label className={styles.label}>描述</label>
            <Input.TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入工作区描述（可选）"
              maxLength={200}
              autoSize={{ minRows: 2, maxRows: 4 }}
              disabled={!isOwner}
            />
          </div>
          {isOwner && (
            <div className={styles.formActions}>
              <Button
                type="primary"
                onClick={handleSave}
                loading={saving}
                disabled={!name.trim()}
              >
                保存
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* 成员管理 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <TeamOutlined /> 成员管理
          </h2>
          {isOwner && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setInviteModalOpen(true)}
            >
              邀请成员
            </Button>
          )}
        </div>

        {loadingMembers ? (
          <div className={styles.memberList}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.memberItem}>
                <Skeleton.Avatar active size={40} />
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <Empty description="暂无成员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className={styles.memberList}>
            {members.map((member) => (
              <div key={member.id} className={styles.memberItem}>
                <Avatar
                  size={40}
                  src={member.avatarUrl}
                  icon={<UserOutlined />}
                  className={styles.memberAvatar}
                />
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>{member.username}</span>
                  <span className={styles.memberEmail}>{member.email}</span>
                </div>
                <div className={styles.memberActions}>
                  {isOwner && member.role !== 'OWNER' ? (
                    <Select
                      value={member.role}
                      options={ROLE_OPTIONS.filter((o) => o.value !== 'OWNER')}
                      onChange={(value) => handleRoleChange(member.userId, value)}
                      className={styles.roleSelect}
                      size="small"
                    />
                  ) : (
                    <span className={styles.roleTag}>
                      {ROLE_OPTIONS.find((r) => r.value === member.role)?.label ?? member.role}
                    </span>
                  )}
                  {isOwner && member.role !== 'OWNER' && (
                    <Popconfirm
                      title="确认移除"
                      description={`确定要移除 ${member.username} 吗？`}
                      onConfirm={() => handleRemove(member.userId)}
                      okText="移除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 危险区域 */}
      {isOwner && (
        <section className={`${styles.section} ${styles.dangerSection}`}>
          <h2 className={styles.sectionTitle}>
            <ExclamationCircleOutlined /> 危险区域
          </h2>
          <div className={styles.dangerContent}>
            <div>
              <h3 className={styles.dangerTitle}>删除工作区</h3>
              <p className={styles.dangerDesc}>
                删除后，工作区内的所有数据（智能体、工作流、对话等）将被永久删除，且无法恢复。
              </p>
            </div>
            <Popconfirm
              title="确认删除工作区"
              description="此操作不可逆，所有数据将被永久删除"
              onConfirm={handleDelete}
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger>删除工作区</Button>
            </Popconfirm>
          </div>
        </section>
      )}

      {/* 邀请成员弹窗 */}
      <Modal
        title="邀请成员"
        open={inviteModalOpen}
        onCancel={() => {
          setInviteModalOpen(false);
          setInviteEmail('');
        }}
        footer={null}
        destroyOnClose
      >
        <div className={styles.inviteForm}>
          <p className={styles.inviteHint}>
            输入成员的邮箱地址，将其添加到当前工作区
          </p>
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="输入邮箱地址"
            onPressEnter={handleInvite}
            type="email"
          />
          <div className={styles.inviteActions}>
            <Button
              onClick={() => {
                setInviteModalOpen(false);
                setInviteEmail('');
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleInvite}
              loading={inviting}
              disabled={!inviteEmail.trim()}
            >
              添加
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
