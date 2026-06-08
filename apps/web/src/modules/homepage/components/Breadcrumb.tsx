import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Breadcrumb as AntBreadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

interface BreadcrumbItem {
  title: string;
  path?: string;
  icon?: React.ReactNode;
}

// 路径到面包屑的映射
const ROUTE_BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
  '/workspace': [{ title: '工作台', icon: <HomeOutlined /> }],
  '/workspace/chat': [
    { title: '工作台', path: '/workspace' },
    { title: 'AI 对话' },
  ],
  '/agents': [{ title: '智能体' }],
  '/workflows': [{ title: '工作流' }],
  '/knowledge': [{ title: '知识库' }],
  '/knowledge/pipeline': [
    { title: '知识库', path: '/knowledge' },
    { title: '生产流水线' },
  ],
  '/plugins': [{ title: '插件' }],
  '/publish': [{ title: '发布' }],
  '/settings': [{ title: '设置' }],
  '/profile': [{ title: '个人中心' }],
};

function matchBreadcrumb(pathname: string): BreadcrumbItem[] {
  // 精确匹配
  if (ROUTE_BREADCRUMB_MAP[pathname]) {
    return ROUTE_BREADCRUMB_MAP[pathname];
  }

  // 前缀匹配（取最长匹配）
  const matched = Object.entries(ROUTE_BREADCRUMB_MAP)
    .filter(([key]) => pathname.startsWith(key))
    .sort((a, b) => b[0].length - a[0].length);

  if (matched.length > 0) {
    const [key, items] = matched[0];
    const suffix = pathname.slice(key.length).replace(/^\//, '');
    if (suffix) {
      // 动态段（如 agentId）附加为最后一级
      return [...items, { title: suffix }];
    }
    return items;
  }

  return [{ title: '首页' }];
}

export function AppBreadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(() => {
    const crumbs = matchBreadcrumb(location.pathname);
    return [
      {
        title: <HomeOutlined onClick={() => navigate('/workspace')} style={{ cursor: 'pointer' }} />,
      },
      ...crumbs.map((crumb) => ({
        title: crumb.path ? (
          <span
            style={{ cursor: 'pointer', color: 'var(--link-color, #565fe2)' }}
            onClick={() => navigate(crumb.path!)}
          >
            {crumb.title}
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {crumb.icon}
            {crumb.title}
          </span>
        ),
      })),
    ];
  }, [location.pathname, navigate]);

  return (
    <AntBreadcrumb
      items={items}
      style={{ fontSize: 13, lineHeight: 1 }}
    />
  );
}
