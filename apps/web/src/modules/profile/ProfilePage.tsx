import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Breadcrumb,
  Button,
  Col,
  Empty,
  Form,
  Input,
  message,
  Row,
  Segmented,
  Skeleton,
  Statistic,
  Tag,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CrownOutlined,
  EditOutlined,
  FireOutlined,
  HeartFilled,
  HeartOutlined,
  LockOutlined,
  MailOutlined,
  MessageOutlined,
  PhoneOutlined,
  PushpinFilled,
  PushpinOutlined,
  RiseOutlined,
  RobotOutlined,
  ShareAltOutlined,
  StarOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { changePassword, updateProfile, type UpdateProfilePayload } from '../../api/auth';
import { getCurrentUser, subscribeToAuth } from '../../api/auth/auth-store';
import { getAgentList, type AgentConfig } from '../../api/agent-config';
import {
  getFavoriteAgents,
  getPinnedAgents,
  getUserActivities,
  getUserBadges,
  getUserStats,
  pinAgent,
  unfavoriteAgent,
  unpinAgent,
  type IActivity,
  type IBadge,
  type IFavoriteAgent,
  type IPinnedAgent,
  type IUserStats,
} from '../../api/profile';
import styles from './ProfilePage.module.css';

type PanelKey = 'agents' | 'activity' | 'achievements' | 'settings';
type EditableField = 'username' | 'bio';

interface AgentCardProps {
  agent: AgentConfig;
  pinned: boolean;
  favorited?: boolean;
  actionLoading?: boolean;
  onOpen: (agentId: string) => void;
  onTogglePin?: (agentId: string, pinned: boolean) => void;
  onUnfavorite?: (agentId: string) => void;
}

const activityIconMap: Record<IActivity['type'], React.ReactNode> = {
  agent_created: <RobotOutlined />,
  agent_favorited: <HeartFilled />,
  milestone: <RiseOutlined />,
  badge_earned: <TrophyOutlined />,
};

const badgeIconMap: Record<string, React.ReactNode> = {
  fire: <FireOutlined />,
  crown: <CrownOutlined />,
  rise: <RiseOutlined />,
  thunderbolt: <ThunderboltOutlined />,
  trophy: <TrophyOutlined />,
  star: <StarOutlined />,
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const AgentCard = React.memo(function AgentCard({
  agent,
  pinned,
  favorited,
  actionLoading,
  onOpen,
  onTogglePin,
  onUnfavorite,
}: AgentCardProps) {
  const handleOpen = useCallback(() => onOpen(agent.id), [agent.id, onOpen]);
  const handlePin = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onTogglePin?.(agent.id, pinned);
  }, [agent.id, onTogglePin, pinned]);
  const handleUnfavorite = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onUnfavorite?.(agent.id);
  }, [agent.id, onUnfavorite]);

  return (
    <div className={styles.agentCard} onClick={handleOpen} role="button" tabIndex={0}>
      <div className={styles.agentHeader}>
        <Avatar
          size={44}
          src={agent.avatar ? <img src={agent.avatar} alt={agent.name} loading="lazy" /> : undefined}
          icon={!agent.avatar && <RobotOutlined />}
        />
        <div className={styles.agentInfo}>
          <span className={styles.agentName}>{agent.name}</span>
          <span className={styles.agentDesc}>{agent.description || '暂无描述'}</span>
        </div>
        {onTogglePin && (
          <Tooltip title={pinned ? '取消置顶' : '置顶智能体'}>
            <Button
              className={styles.iconButton}
              type={pinned ? 'primary' : 'text'}
              size="small"
              shape="circle"
              icon={pinned ? <PushpinFilled /> : <PushpinOutlined />}
              loading={actionLoading}
              onClick={handlePin}
            />
          </Tooltip>
        )}
      </div>
      <div className={styles.agentMeta}>
        <Tag>{agent.mode}</Tag>
        {pinned && <Tag color="blue" icon={<PushpinFilled />}>已置顶</Tag>}
        {favorited && <Tag color="magenta" icon={<HeartFilled />}>已收藏</Tag>}
      </div>
      <div className={styles.agentFooter}>
        <span>{agent.model || '默认模型'}</span>
        {onUnfavorite && (
          <Button danger type="text" size="small" icon={<HeartOutlined />} onClick={handleUnfavorite}>
            取消收藏
          </Button>
        )}
      </div>
    </div>
  );
});

export function ProfilePage() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [user, setUser] = useState(getCurrentUser());
  const [activePanel, setActivePanel] = useState<PanelKey>('agents');
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<IUserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [badges, setBadges] = useState<IBadge[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [badgesLoaded, setBadgesLoaded] = useState(false);
  const [favorites, setFavorites] = useState<IFavoriteAgent[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [activities, setActivities] = useState<IActivity[]>([]);
  const [activitiesTotal, setActivitiesTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [pinnedAgents, setPinnedAgents] = useState<IPinnedAgent[]>([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const [pinnedLoaded, setPinnedLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [agentActionId, setAgentActionId] = useState<string | null>(null);

  useEffect(() => subscribeToAuth(() => setUser(getCurrentUser())), []);

  useEffect(() => {
    if (!user) return;
    profileForm.setFieldsValue({
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      bio: user.bio || '',
    });
    setAvatarUrl(user.avatarUrl);
  }, [profileForm, user]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await getUserStats());
    } catch {
      messageApi.error('统计数据加载失败');
    } finally {
      setStatsLoading(false);
    }
  }, [messageApi]);

  const loadAgents = useCallback(async () => {
    if (agentsLoaded || agentsLoading) return;
    setAgentsLoading(true);
    try {
      setAgents(await getAgentList());
      setAgentsLoaded(true);
    } catch {
      setAgentsLoaded(true);
      messageApi.error('创建的智能体加载失败');
    } finally {
      setAgentsLoading(false);
    }
  }, [agentsLoaded, agentsLoading, messageApi]);

  const loadPinned = useCallback(async () => {
    if (pinnedLoaded || pinnedLoading) return;
    setPinnedLoading(true);
    try {
      setPinnedAgents(await getPinnedAgents());
      setPinnedLoaded(true);
    } catch {
      setPinnedLoaded(true);
      messageApi.error('置顶列表加载失败');
    } finally {
      setPinnedLoading(false);
    }
  }, [messageApi, pinnedLoaded, pinnedLoading]);

  const loadFavorites = useCallback(async () => {
    if (favoritesLoaded || favoritesLoading) return;
    setFavoritesLoading(true);
    try {
      setFavorites(await getFavoriteAgents());
      setFavoritesLoaded(true);
    } catch {
      setFavoritesLoaded(true);
      messageApi.error('收藏列表加载失败');
    } finally {
      setFavoritesLoading(false);
    }
  }, [favoritesLoaded, favoritesLoading, messageApi]);

  const loadBadges = useCallback(async () => {
    if (badgesLoaded || badgesLoading) return;
    setBadgesLoading(true);
    try {
      setBadges(await getUserBadges());
      setBadgesLoaded(true);
    } catch {
      setBadgesLoaded(true);
      messageApi.error('荣誉徽章加载失败');
    } finally {
      setBadgesLoading(false);
    }
  }, [badgesLoaded, badgesLoading, messageApi]);

  const loadActivities = useCallback(async (page = 1) => {
    if (activitiesLoading) return;
    setActivitiesLoading(true);
    try {
      const data = await getUserActivities(page);
      setActivities((prev) => (page === 1 ? data.list : [...prev, ...data.list]));
      setActivitiesTotal(data.total);
      setActivityPage(page);
      setActivitiesLoaded(true);
    } catch {
      setActivitiesLoaded(true);
      messageApi.error('动态流加载失败');
    } finally {
      setActivitiesLoading(false);
    }
  }, [activitiesLoading, messageApi]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activePanel === 'agents') {
      void loadAgents();
      void loadFavorites();
      void loadPinned();
    }
    if (activePanel === 'activity') {
      void loadAgents();
      void loadPinned();
      if (!activitiesLoaded) void loadActivities(1);
    }
    if (activePanel === 'achievements') {
      void loadBadges();
    }
  }, [activePanel, activitiesLoaded, loadActivities, loadAgents, loadBadges, loadFavorites, loadPinned]);

  const pinnedIds = useMemo(() => new Set(pinnedAgents.map((item) => item.agentId)), [pinnedAgents]);
  const createdIds = useMemo(() => new Set(agents.map((agent) => agent.id)), [agents]);
  const favoriteAgentIds = useMemo(() => new Set(favorites.map((item) => item.agentId)), [favorites]);
  const orderedCreatedAgents = useMemo(() => {
    return [...agents].sort((a, b) => Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id)));
  }, [agents, pinnedIds]);
  const uniqueFavorites = useMemo(() => favorites.filter((item) => !createdIds.has(item.agentId)), [createdIds, favorites]);
  const pinnedAgentCards = useMemo(() => orderedCreatedAgents.filter((agent) => pinnedIds.has(agent.id)), [orderedCreatedAgents, pinnedIds]);

  const handlePanelChange = useCallback((value: string | number) => {
    setActivePanel(value as PanelKey);
  }, []);

  const handleOpenAgent = useCallback((agentId: string) => {
    navigate(`/agents?agentId=${agentId}`);
  }, [navigate]);

  const handleTogglePin = useCallback(async (agentId: string, isPinned: boolean) => {
    setAgentActionId(agentId);
    try {
      if (isPinned) {
        await unpinAgent(agentId);
        setPinnedAgents((prev) => prev.filter((item) => item.agentId !== agentId));
        messageApi.success('已取消置顶');
      } else {
        await pinAgent(agentId);
        setPinnedAgents((prev) => [{ agentId, pinnedAt: new Date().toISOString() }, ...prev.filter((item) => item.agentId !== agentId)]);
        messageApi.success('已置顶');
      }
    } catch {
      messageApi.error(isPinned ? '取消置顶失败' : '置顶失败');
    } finally {
      setAgentActionId(null);
    }
  }, [messageApi]);

  const handleUnfavorite = useCallback(async (agentId: string) => {
    setAgentActionId(agentId);
    try {
      await unfavoriteAgent(agentId);
      setFavorites((prev) => prev.filter((item) => item.agentId !== agentId));
      messageApi.success('已取消收藏');
    } catch {
      messageApi.error('取消收藏失败');
    } finally {
      setAgentActionId(null);
    }
  }, [messageApi]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/profile${user?.id ? `/${user.id}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      messageApi.success('个人主页链接已复制');
    } catch {
      messageApi.error('复制失败，请手动复制地址栏链接');
    }
  }, [messageApi, user?.id]);

  const beginInlineEdit = useCallback((field: EditableField) => {
    setEditingField(field);
    setEditingValue(field === 'username' ? user?.username ?? '' : user?.bio ?? '');
  }, [user?.bio, user?.username]);

  const commitInlineEdit = useCallback(async () => {
    if (!editingField || !user) return;
    const value = editingValue.trim();
    if (editingField === 'username' && !value) {
      messageApi.error('昵称不能为空');
      return;
    }
    if (value === (editingField === 'username' ? user.username : user.bio || '')) {
      setEditingField(null);
      return;
    }
    try {
      await updateProfile({ [editingField]: value } as UpdateProfilePayload);
      messageApi.success('资料已更新');
      setEditingField(null);
    } catch {
      messageApi.error('资料保存失败');
    }
  }, [editingField, editingValue, messageApi, user]);

  const cancelInlineEdit = useCallback(() => {
    setEditingField(null);
    setEditingValue('');
  }, []);

  const handleInlineKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void commitInlineEdit();
    }
    if (event.key === 'Escape') {
      cancelInlineEdit();
    }
  }, [cancelInlineEdit, commitInlineEdit]);

  const handleAvatarChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (readerEvent) => resolve(readerEvent.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setAvatarUrl(dataUrl);
      await updateProfile({ avatarUrl: dataUrl });
      messageApi.success('头像已更新');
    } catch {
      messageApi.error('头像上传失败');
    } finally {
      event.target.value = '';
    }
  }, [messageApi]);

  const handleSaveProfile = useCallback(async () => {
    try {
      const values = await profileForm.validateFields();
      setSaving(true);
      await updateProfile({
        username: values.username,
        email: values.email,
        phone: values.phone || '',
        bio: values.bio || '',
      });
      messageApi.success('个人信息已保存');
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      messageApi.error('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }, [messageApi, profileForm]);

  const handleChangePassword = useCallback(async () => {
    try {
      const values = await passwordForm.validateFields();
      setChangingPassword(true);
      await changePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword });
      messageApi.success('密码已修改');
      passwordForm.resetFields();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      messageApi.error(error instanceof Error ? error.message : '密码修改失败');
    } finally {
      setChangingPassword(false);
    }
  }, [messageApi, passwordForm]);

  const renderAgentPanel = useCallback(() => (
    <div className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>创建的智能体</h3>
          <Button type="primary" icon={<RobotOutlined />} onClick={() => navigate('/agents')}>
            创建智能体
          </Button>
        </div>
        {agentsLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : orderedCreatedAgents.length ? (
          <div className={styles.agentGrid}>
            {orderedCreatedAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                pinned={pinnedIds.has(agent.id)}
                favorited={favoriteAgentIds.has(agent.id)}
                actionLoading={agentActionId === agent.id}
                onOpen={handleOpenAgent}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        ) : (
          <Empty description="还没有创建智能体">
            <Button type="primary" onClick={() => navigate('/agents')}>去创建</Button>
          </Empty>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>收藏的智能体</h3>
          <span>{uniqueFavorites.length} 个收藏</span>
        </div>
        {favoritesLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : uniqueFavorites.length ? (
          <div className={styles.agentGrid}>
            {uniqueFavorites.map((item) => (
              <AgentCard
                key={item.id}
                agent={item.agent}
                pinned={pinnedIds.has(item.agentId)}
                favorited
                actionLoading={agentActionId === item.agentId}
                onOpen={handleOpenAgent}
                onUnfavorite={handleUnfavorite}
              />
            ))}
          </div>
        ) : (
          <Empty description="暂无收藏的智能体">
            <Button onClick={() => navigate('/agents')}>发现智能体</Button>
          </Empty>
        )}
      </section>
    </div>
  ), [agentActionId, agentsLoading, favoriteAgentIds, favoritesLoading, handleOpenAgent, handleTogglePin, handleUnfavorite, navigate, orderedCreatedAgents, pinnedIds, uniqueFavorites]);

  const renderActivityPanel = useCallback(() => (
    <div className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>动态流</h3>
          <span>{activitiesTotal} 条动态</span>
        </div>
        {activitiesLoading && !activities.length ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : activities.length ? (
          <>
            <div className={styles.timeline}>
              {activities.map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <span className={styles.activityIcon}>{activityIconMap[activity.type]}</span>
                  <div className={styles.activityBody}>
                    <span>{activity.content}</span>
                    <time>{formatDateTime(activity.createdAt)}</time>
                  </div>
                </div>
              ))}
            </div>
            {activities.length < activitiesTotal && (
              <Button block loading={activitiesLoading} onClick={() => void loadActivities(activityPage + 1)}>
                加载更多
              </Button>
            )}
          </>
        ) : (
          <Empty description="暂无动态，去和智能体互动吧" />
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>精选展示区</h3>
          <span>{pinnedAgentCards.length} 个置顶</span>
        </div>
        {pinnedLoading || agentsLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : pinnedAgentCards.length ? (
          <div className={styles.featuredGrid}>
            {pinnedAgentCards.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                pinned
                actionLoading={agentActionId === agent.id}
                onOpen={handleOpenAgent}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        ) : (
          <Empty description="置顶你最满意的智能体后会展示在这里" />
        )}
      </section>
    </div>
  ), [activities, activitiesLoading, activitiesTotal, activityPage, agentActionId, agentsLoading, handleOpenAgent, handleTogglePin, loadActivities, pinnedAgentCards, pinnedLoading]);

  const renderAchievementPanel = useCallback(() => (
    <div className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>创作数据看板</h3>
        </div>
        {statsLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}><Statistic className={styles.statCard} title="总对话" value={stats?.conversations ?? 0} prefix={<MessageOutlined />} /></Col>
            <Col xs={12} md={6}><Statistic className={styles.statCard} title="获赞" value={stats?.likes ?? 0} prefix={<HeartFilled />} /></Col>
            <Col xs={12} md={6}><Statistic className={styles.statCard} title="满意度" value={stats?.satisfaction ?? 0} suffix="%" prefix={<StarOutlined />} /></Col>
            <Col xs={12} md={6}><Statistic className={styles.statCard} title="本月收益" value={formatMoney(stats?.monthlyEarnings ?? 0)} /></Col>
          </Row>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>荣誉徽章</h3>
          <span>{badges.length} 枚</span>
        </div>
        {badgesLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : badges.length ? (
          <div className={styles.badgeGrid}>
            {badges.map((badge) => (
              <Tooltip key={badge.id} title={badge.name}>
                <div className={styles.badgeItem}>
                  <span className={styles.badgeIcon}>{badgeIconMap[badge.icon] ?? <TrophyOutlined />}</span>
                  <span>{badge.name}</span>
                </div>
              </Tooltip>
            ))}
          </div>
        ) : (
          <Empty description="暂无荣誉徽章" />
        )}
      </section>
    </div>
  ), [badges, badgesLoading, stats, statsLoading]);

  const renderSettingsPanel = useCallback(() => (
    <div className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>基本信息</h3>
        </div>
        <div className={styles.avatarRow}>
          <Avatar size={80} src={avatarUrl ?? undefined} icon={!avatarUrl && <UserOutlined />} />
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>更换头像</Button>
          <input ref={fileInputRef} className={styles.fileInput} type="file" accept="image/*" onChange={handleAvatarChange} />
        </div>
        <Form form={profileForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="username" label="昵称" rules={[{ required: true, message: '请输入昵称' }, { min: 2, max: 20, message: '昵称长度为 2-20 个字符' }]}>
                <Input prefix={<UserOutlined />} placeholder="请输入昵称" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
                <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label="联系电话" rules={[{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }]}>
                <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="bio" label="个人简介">
                <Input.TextArea rows={2} maxLength={200} showCount placeholder="介绍一下自己" />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" loading={saving} onClick={handleSaveProfile}>保存修改</Button>
        </Form>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>修改密码</h3>
        </div>
        <Form form={passwordForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="当前密码" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少 6 个字符' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="新密码" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" loading={changingPassword} onClick={handleChangePassword}>确认修改</Button>
        </Form>
      </section>
    </div>
  ), [avatarUrl, changingPassword, handleAvatarChange, handleChangePassword, handleSaveProfile, passwordForm, profileForm, saving]);

  if (!user) return null;

  return (
    <div className={styles.container}>
      {contextHolder}
      <header className={styles.toolbar}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/workspace')}>返回工作台</Button>
        <div>
          <Breadcrumb items={[{ title: '工作台' }, { title: '个人中心' }]} />
          <h1>个人中心</h1>
        </div>
        <div className={styles.toolbarActions}>
          <Button icon={<ShareAltOutlined />} onClick={handleShare}>分享</Button>
          <Button icon={<EditOutlined />} onClick={() => setActivePanel('settings')}>编辑</Button>
        </div>
      </header>

      <section className={styles.identityBanner}>
        <Avatar size={40} src={avatarUrl ?? undefined} icon={!avatarUrl && <UserOutlined />} />
        <div className={styles.identityMain}>
          <div className={styles.identityNameRow}>
            {editingField === 'username' ? (
              <Input autoFocus size="small" value={editingValue} onChange={(event) => setEditingValue(event.target.value)} onBlur={() => void commitInlineEdit()} onKeyDown={handleInlineKeyDown} />
            ) : (
              <>
                <strong>{user.username}</strong>
                <CheckCircleFilled className={styles.verifiedIcon} />
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => beginInlineEdit('username')} />
              </>
            )}
          </div>
          <div className={styles.identityBioRow}>
            {editingField === 'bio' ? (
              <Input.TextArea autoFocus value={editingValue} rows={1} maxLength={200} onChange={(event) => setEditingValue(event.target.value)} onBlur={() => void commitInlineEdit()} onKeyDown={handleInlineKeyDown} />
            ) : (
              <>
                <span>{user.bio || '这个人很低调，还没有写简介'}</span>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => beginInlineEdit('bio')} />
              </>
            )}
          </div>
        </div>
        <div className={styles.identityStats}>
          {statsLoading ? (
            <Skeleton.Button active size="small" className={styles.statsSkeleton} />
          ) : (
            <>
              <span><strong>{stats?.fans ?? 0}</strong> 粉丝</span>
              <span><strong>{stats?.likes ?? 0}</strong> 获赞</span>
              <span><strong>{stats?.agentsCreated ?? 0}</strong> 智能体</span>
              <span><strong>{stats?.conversations ?? 0}</strong> 总对话</span>
            </>
          )}
        </div>
      </section>

      <Segmented
        block
        className={styles.segmented}
        value={activePanel}
        onChange={handlePanelChange}
        options={[
          { label: '智能体', value: 'agents', icon: <RobotOutlined /> },
          { label: '动态', value: 'activity', icon: <RiseOutlined /> },
          { label: '成就', value: 'achievements', icon: <TrophyOutlined /> },
          { label: '设置', value: 'settings', icon: <EditOutlined /> },
        ]}
      />

      <main className={styles.content}>
        {activePanel === 'agents' && renderAgentPanel()}
        {activePanel === 'activity' && renderActivityPanel()}
        {activePanel === 'achievements' && renderAchievementPanel()}
        {activePanel === 'settings' && renderSettingsPanel()}
      </main>
    </div>
  );
}
