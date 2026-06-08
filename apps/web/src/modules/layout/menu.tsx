import type { ReactNode } from 'react';
import {
  ApiOutlined,
  AppstoreOutlined,
  BookOutlined,
  CodeSandboxOutlined,
  DeploymentUnitOutlined,
  HomeOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  RocketOutlined,
  SettingOutlined,
} from '@ant-design/icons';

export interface AppMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  path?: string;
  children?: AppMenuItem[];
}

export const appMenuItems: AppMenuItem[] = [
  {
    key: 'workspace',
    label: '工作台',
    path: '/workspace',
    icon: <HomeOutlined />,
  },
  {
    key: 'workspace.chat',
    label: 'AI对话',
    path: '/workspace/chat',
    icon: <MessageOutlined />,
  },
  {
    key: 'agents',
    label: '智能体',
    path: '/agents',
    icon: <AppstoreOutlined />,
  },
  {
    key: 'workflows',
    label: '工作流',
    path: '/workflows',
    icon: <DeploymentUnitOutlined />,
    children: [
      {
        key: 'workflows.list',
        label: '工作流管理',
        path: '/workflows',
        icon: <NodeIndexOutlined />,
      },
    ],
  },
  {
    key: 'knowledge-bases',
    label: '知识库',
    icon: <BookOutlined />,
    children: [
      {
        key: 'knowledge-bases.detail',
        label: '知识库详情',
        path: '/knowledge',
        icon: <BookOutlined />,
      },
      {
        key: 'knowledge-bases.pipeline',
        label: '生产流水线',
        path: '/knowledge/pipeline',
        icon: <CodeSandboxOutlined />,
      },
    ],
  },
  {
    key: 'plugins',
    label: '插件',
    path: '/plugins',
    icon: <ApiOutlined />,
  },
  {
    key: 'publish',
    label: '发布',
    path: '/publish',
    icon: <RocketOutlined />,
  },
  {
    key: 'settings',
    label: '设置',
    path: '/settings',
    icon: <SettingOutlined />,
  },
];

export function flattenMenuItems(items: AppMenuItem[]): AppMenuItem[] {
  return items.flatMap((item) => [
    item,
    ...(item.children ? flattenMenuItems(item.children) : []),
  ]);
}

export function getMenuParentKeys(items: AppMenuItem[], targetKey: string): string[] {
  for (const item of items) {
    if (item.key === targetKey) return [];

    if (item.children) {
      const childParentKeys = getMenuParentKeys(item.children, targetKey);
      const childMatched = childParentKeys.length > 0 || item.children.some((child) => child.key === targetKey);
      if (childMatched) {
        return [item.key, ...childParentKeys];
      }
    }
  }

  return [];
}
