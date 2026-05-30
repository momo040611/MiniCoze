import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  message,
  Tabs,
  Tag,
  Empty,
  Spin,
  Row,
  Col,
  Statistic,
  Tooltip,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  EditOutlined,
  LockOutlined,
  UploadOutlined,
  RobotOutlined,
  HeartOutlined,
  StarOutlined,
  MessageOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  FireOutlined,
  CrownOutlined,
  RiseOutlined,
  PlusOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { getCurrentUser, subscribeToAuth } from '../../api/auth/auth-store';
import { updateProfile, changePassword } from '../../api/auth';
import type { UpdateProfilePayload } from '../../api/auth';
import { getAgentList } from '../../api/agent-config';
import type { AgentConfig } from '../../api/agent-config';
import styles from './ProfilePage.module.css';

// ===== 模拟荣誉徽章数据 =====
const BADGES = [
  { icon: <FireOutlined />, label: '周榜达人', color: '#f5222d' },
  { icon: <CrownOutlined />, label: '优质开发者', color: '#faad14' },
  { icon: <RiseOutlined />, label: '新人王', color: '#52c41a' },
  { icon: <ThunderboltOutlined />, label: '人气爆棚', color: '#722ed1' },
];

// ===== 模拟统计数据 =====
const MOCK_STATS = {
  fans: 128,
  likes: 356,
  conversations: 1892,
};

export function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeToAuth(() => setUser(getCurrentUser()));
  }, []);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        username: user.username,
        email: user.email,
        phone: user.phone || '',
        bio: user.bio || '',
      });
      setAvatarUrl(user.avatarUrl);
    }
  }, [user, profileForm]);

  useEffect(() => {
    getAgentList()
      .then((list) => setAgents(list))
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, []);

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setAvatarUrl(dataUrl);
      await updateProfile({ avatarUrl: dataUrl });
      message.success('头像更新成功');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '头像上传失败';
      message.error(msg);
    }
  }, []);

  const handleSaveProfile = useCallback(async () => {
    try {
      const values = await profileForm.validateFields();
      setSaving(true);
      const payload: UpdateProfilePayload = {
        username: values.username,
        email: values.email,
        phone: values.phone || '',
        bio: values.bio || '',
      };
      await updateProfile(payload);
      message.success('个人信息已更新');
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }, [profileForm]);

  const handleChangePassword = useCallback(async () => {
    try {
      const values = await passwordForm.validateFields();
      setChangingPassword(true);
      await changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      message.success('密码修改成功');
      passwordForm.resetFields();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(err instanceof Error ? err.message : '密码修改失败');
    } finally {
      setChangingPassword(false);
    }
  }, [passwordForm]);

  if (!user) return null;

  // ===== 折叠面板：智能体作品集 =====
  const agentPanel = (
    <div className={styles.panelContent}>
      {/* 子板块：创建的智能体 */}
      <div className={styles.subSection}>
        <h4 className={styles.subTitle}>
          <RobotOutlined /> 创建的智能体
        </h4>
        {agentsLoading ? (
          <div className={styles.loadingWrap}><Spin /></div>
        ) : agents.length > 0 ? (
          <div className={styles.agentGrid}>
            {agents.map((agent) => (
              <div key={agent.id} className={styles.agentCard} onClick={() => navigate('/agents')}>
                <div className={styles.agentCardTop}>
                  <Avatar size={44} src={agent.avatar || undefined} icon={!agent.avatar && <RobotOutlined />} />
                  <div className={styles.agentCardInfo}>
                    <span className={styles.agentCardName}>{agent.name}</span>
                    <span className={styles.agentCardDesc}>{agent.description || '暂无描述'}</span>
                  </div>
                  <Tag color="blue" className={styles.agentCardTag}>{agent.mode}</Tag>
                </div>
                <div className={styles.agentCardStats}>
                  <span><MessageOutlined /> 128</span>
                  <span><HeartOutlined /> 56</span>
                  <span><StarOutlined /> 23</span>
                </div>
                <div className={styles.agentCardActions}>
                  <Button size="small" type="primary" ghost icon={<RobotOutlined />}>去对话</Button>
                  <Button size="small" type="text" icon={<HeartOutlined />}>点赞</Button>
                  <Button size="small" type="text" icon={<ShareAltOutlined />}>分享</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未创建智能体">
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => navigate('/agents')}>
              创建智能体
            </Button>
          </Empty>
        )}
      </div>

      {/* 子板块：收藏的智能体 */}
      <div className={styles.subSection}>
        <h4 className={styles.subTitle}>
          <StarOutlined /> 收藏的智能体
        </h4>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无收藏的智能体">
          <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => navigate('/agents')}>
            发现智能体
          </Button>
        </Empty>
      </div>
    </div>
  );

  // ===== 折叠面板：动态与影响力 =====
  const activityPanel = (
    <div className={styles.panelContent}>
      <div className={styles.subSection}>
        <h4 className={styles.subTitle}>
          <RiseOutlined /> 动态流
        </h4>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无动态，快去与智能体互动吧" />
      </div>
      <div className={styles.subSection}>
        <h4 className={styles.subTitle}>
          <StarOutlined /> 精选展示区
        </h4>
        <div className={styles.featuredGrid}>
          {agents.slice(0, 3).map((agent) => (
            <div key={agent.id} className={styles.featuredCard} onClick={() => navigate('/agents')}>
              <Avatar size={48} src={agent.avatar || undefined} icon={!agent.avatar && <RobotOutlined />} />
              <span className={styles.featuredName}>{agent.name}</span>
              <Tag className={styles.featuredTag}>已置顶</Tag>
            </div>
          ))}
          {agents.length === 0 && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="置顶你最满意的智能体" />
          )}
        </div>
      </div>
    </div>
  );

  // ===== 折叠面板：数据与成就 =====
  const achievementPanel = (
    <div className={styles.panelContent}>
      <div className={styles.subSection}>
        <h4 className={styles.subTitle}>
          <ThunderboltOutlined /> 创作数据看板
        </h4>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card className={styles.dataCard} size="small">
              <Statistic
                title="总对话次数"
                value={MOCK_STATS.conversations}
                prefix={<MessageOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className={styles.dataCard} size="small">
              <Statistic
                title="获赞数"
                value={MOCK_STATS.likes}
                prefix={<HeartOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className={styles.dataCard} size="small">
              <Statistic
                title="用户满意度"
                value={96}
                suffix="%"
                prefix={<StarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className={styles.dataCard} size="small">
              <Statistic
                title="本月收益"
                value={1280}
                prefix="¥"
              />
            </Card>
          </Col>
        </Row>
      </div>
      <div className={styles.subSection}>
        <h4 className={styles.subTitle}>
          <TrophyOutlined /> 荣誉徽章
        </h4>
        <div className={styles.badgeGrid}>
          {BADGES.map((badge) => (
            <Tooltip key={badge.label} title={badge.label}>
              <div className={styles.badgeItem}>
                <span className={styles.badgeIcon} style={{ color: badge.color, background: `${badge.color}15` }}>
                  {badge.icon}
                </span>
                <span className={styles.badgeLabel}>{badge.label}</span>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );

  // ===== 折叠面板数据 =====
  const collapseItems = [
    {
      key: 'agents',
      label: (
        <div className={styles.collapseLabel}>
          <RobotOutlined className={styles.collapseIcon} />
          <span>智能体作品集</span>
          <Tag className={styles.collapseCount}>{agents.length}</Tag>
        </div>
      ),
      children: agentPanel,
    },
    {
      key: 'activity',
      label: (
        <div className={styles.collapseLabel}>
          <RiseOutlined className={styles.collapseIcon} />
          <span>动态与影响力</span>
        </div>
      ),
      children: activityPanel,
    },
    {
      key: 'achievement',
      label: (
        <div className={styles.collapseLabel}>
          <TrophyOutlined className={styles.collapseIcon} />
          <span>数据与成就</span>
        </div>
      ),
      children: achievementPanel,
    },
  ];

  // ===== 设置 Tab =====
  const tabItems = [
    {
      key: 'profile',
      label: <span><EditOutlined /> 基本信息</span>,
      children: (
        <div className={styles.settingsContent}>
          <div className={styles.avatarRow}>
            <div className={styles.avatarEditWrap}>
              <Avatar size={80} src={avatarUrl ?? undefined} icon={!avatarUrl && <UserOutlined />} />
              <button className={styles.avatarEditBtn} type="button" onClick={() => fileInputRef.current?.click()}>
                <UploadOutlined />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>
          <Form form={profileForm} layout="vertical" className={styles.settingsForm}
            initialValues={{
              username: user.username, email: user.email,
              phone: user.phone || '', bio: user.bio || '',
            }}
          >
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item name="username" label="昵称"
                  rules={[{ required: true, message: '请输入昵称' }, { min: 2, max: 20, message: '昵称长度 2-20 个字符' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="请输入昵称" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="email" label="邮箱"
                  rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
                >
                  <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item name="phone" label="联系电话"
                  rules={[{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }]}
                >
                  <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="bio" label="个人简介">
                  <Input.TextArea rows={1} placeholder="介绍一下自己..." maxLength={200} showCount />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button type="primary" size="large" loading={saving} onClick={handleSaveProfile}>保存修改</Button>
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      key: 'password',
      label: <span><LockOutlined /> 修改密码</span>,
      children: (
        <div className={styles.settingsContent}>
          <Form form={passwordForm} layout="vertical" className={styles.settingsForm}>
            <Form.Item name="oldPassword" label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }, { min: 6, message: '密码至少 6 个字符' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入当前密码" />
            </Form.Item>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item name="newPassword" label="新密码"
                  rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少 6 个字符' }]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']}
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
                  <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Button type="primary" size="large" loading={changingPassword} onClick={handleChangePassword}>确认修改</Button>
            </Form.Item>
          </Form>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>个人中心</h2>
        <p className={styles.pageSubtitle}>管理你的个人信息和作品</p>
      </div>

      {/* ═══ 核心身份区 ═══ */}
      <div className={styles.identityCard}>
        <div className={styles.identityBg} />
        <div className={styles.identityInner}>
          <div className={styles.identityLeft}>
            <div className={styles.identityAvatar}>
              <Avatar size={88} src={avatarUrl ?? undefined} icon={!avatarUrl && <UserOutlined />} />
              <CheckCircleFilled className={styles.verifiedBadge} />
            </div>
          <div className={styles.identityInfo}>
            <h1 className={styles.identityName}>{user.username}</h1>
            <p className={styles.identityBio}>{user.bio || '这个人很懒，什么都没留下~'}</p>
          </div>
          </div>
          <div className={styles.identityStats}>
            <div className={styles.identityStatItem}>
              <span className={styles.identityStatValue}>{MOCK_STATS.fans}</span>
              <span className={styles.identityStatLabel}>粉丝</span>
            </div>
            <div className={styles.identityStatItem}>
              <span className={styles.identityStatValue}>{MOCK_STATS.likes}</span>
              <span className={styles.identityStatLabel}>获赞</span>
            </div>
            <div className={styles.identityStatItem}>
              <span className={styles.identityStatValue}>{agents.length}</span>
              <span className={styles.identityStatLabel}>智能体</span>
            </div>
            <div className={styles.identityStatItem}>
              <span className={styles.identityStatValue}>{MOCK_STATS.conversations}</span>
              <span className={styles.identityStatLabel}>总对话</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 中部页面结构（Collapse + Tabs） ═══ */}
      <Card className={styles.contentCard}>
        <Collapse
          ghost
          items={collapseItems}
          className={styles.mainCollapse}
          defaultActiveKey={['agents']}
        />
      </Card>

      {/* ═══ 账号设置 ═══ */}
      <Card className={styles.settingsCard}>
        <Tabs defaultActiveKey="profile" items={tabItems} />
      </Card>
    </div>
  );
}
