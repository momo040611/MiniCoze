import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Button, ConfigProvider, Dropdown, Menu, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  DownOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { logout } from '../../api/auth';
import { getCurrentUser, subscribeToAuth } from '../../api/auth/auth-store';
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher';
import { appMenuItems, flattenMenuItems, getMenuParentKeys } from './menu';
import { AppBreadcrumb } from '../../components/Breadcrumb';
import { GlobalSearch } from '../../components/GlobalSearch';
import styles from './AppLayout.module.css';

const flatMenuItems = flattenMenuItems(appMenuItems);

function getSelectedMenuKey(pathname: string) {
  const matched = flatMenuItems
    .filter((item) => item.path && (pathname === item.path || pathname.startsWith(`${item.path}/`)))
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0];

  return matched?.key ?? '';
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  // 订阅 auth 数据变化（头像/昵称修改后自动刷新）
  useEffect(() => {
    return subscribeToAuth(() => {
      setUser(getCurrentUser());
    });
  }, []);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') ?? 'light';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const selectedKey = getSelectedMenuKey(location.pathname);
  const selectedParentKeys = selectedKey ? getMenuParentKeys(appMenuItems, selectedKey) : [];

  useEffect(() => {
    if (!collapsed) {
      setOpenKeys((currentKeys) => Array.from(new Set([...currentKeys, ...selectedParentKeys])));
    }
  }, [collapsed, selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 监听系统主题偏好变化
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // 应用 CSS 变量主题到 document
  useEffect(() => {
    localStorage.setItem('theme', themeMode);
    if (themeMode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (themeMode === 'system') {
      document.documentElement.setAttribute('data-theme', systemPrefersDark ? 'dark' : '');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [themeMode, systemPrefersDark]);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);

  const sidebarMenuItems: MenuProps['items'] = useMemo(
    () =>
      appMenuItems.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
        children: item.children?.map((child) => ({
          key: child.key,
          icon: child.icon,
          label: child.label,
        })),
      })),
    [],
  );

  const userDropdownItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'username-display',
        label: user?.username ?? '用户',
        disabled: true,
      },
      { type: 'divider' },
      {
        key: 'profile',
        label: '个人中心',
        icon: <UserOutlined />,
      },
      {
        key: 'theme',
        label: '主题',
        popupOffset: [8, 0],
        children: [
          { key: 'theme-light', label: '亮色' },
          { key: 'theme-dark', label: '暗色' },
          { key: 'theme-system', label: '跟随系统' },
        ],
      },
      { key: 'download', label: '下载客户端' },
      { key: 'settings', label: '设置' },
      { key: 'docs', label: '文档' },
      {
        key: 'contact',
        label: '联系我们',
        popupOffset: [8, 0],
        children: [
          { key: 'contact-email', label: '邮箱' },
          { key: 'contact-github', label: 'GitHub' },
        ],
      },
      { type: 'divider' },
      {
        key: 'logout',
        label: '退出登录',
        icon: <LogoutOutlined />,
        danger: true,
      },
    ],
    [user?.username],
  );

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    } else if (key === 'profile') {
      navigate('/profile');
    } else if (key === 'theme-light') {
      setThemeMode('light');
    } else if (key === 'theme-dark') {
      setThemeMode('dark');
    } else if (key === 'theme-system') {
      setThemeMode('system');
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
    <div className={styles.appLayout}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarMobileOpen : ''}`}>
        {!collapsed ? (
          <div className={styles.sidebarTop}>
            <div className={styles.brand}>
              <div className={styles.brandIcon}>
                <RobotOutlined />
              </div>
              <span className={styles.brandText}>AI Agent 平台</span>
            </div>
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
              className={styles.collapseButton}
              aria-label="收起侧边栏"
            />
          </div>
        ) : (
          <Button
            type="text"
            icon={<MenuUnfoldOutlined />}
            onClick={() => setCollapsed((value) => !value)}
            className={styles.collapseButton}
            aria-label="展开侧边栏"
          />
        )}

        <Menu
          className={styles.navMenu}
          mode="inline"
          inlineCollapsed={collapsed}
          items={sidebarMenuItems}
          selectedKeys={selectedKey ? [selectedKey] : []}
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={setOpenKeys}
          onClick={({ key }) => {
            const target = flatMenuItems.find((item) => item.key === key);
            if (target?.path) {
              navigate(target.path);
            }
          }}
        />

        <div className={`${styles.sidebarUser} ${collapsed ? styles.sidebarUserCollapsed : ''}`}>
          <Dropdown
            menu={{ items: userDropdownItems, onClick: handleUserMenuClick }}
            placement="topLeft"
            trigger={['click']}
          >
            {collapsed ? (
              <button className={styles.userButtonCompact} type="button">
                <Avatar size={34} src={user?.avatarUrl ?? undefined} icon={!user?.avatarUrl && <UserOutlined />} />
              </button>
            ) : (
              <button className={styles.userButton} type="button">
                <Avatar size={34} src={user?.avatarUrl ?? undefined} icon={!user?.avatarUrl && <UserOutlined />} />
                <span className={styles.userName}>{user?.username ?? '用户'}</span>
                <DownOutlined className={styles.userArrow} />
              </button>
            )}
          </Dropdown>
        </div>
      </aside>

      {/* 移动端遮罩层 */}
      <div
        className={`${styles.sidebarMask} ${mobileOpen ? styles.sidebarMaskVisible : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setMobileOpen(true)}
              className={styles.mobileMenuBtn}
              aria-label="打开菜单"
            />
            <AppBreadcrumb />
          </div>
          <div className={styles.headerCenter}>
            <GlobalSearch />
          </div>
          <div className={styles.headerRight}>
            <WorkspaceSwitcher />
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </section>
    </div>
    </ConfigProvider>
  );
}
