import { App, Breadcrumb, Button, Empty, Input, Pagination, Popconfirm, Select, Skeleton, Tag } from 'antd';
import {
  ApiOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  FunctionOutlined,
  ReloadOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../workspace/use-workspace';
import { usePlugins } from '../hooks/usePlugins';
import type { IPlugin, PluginStatus, PluginType } from '../../../api/plugins';
import styles from './PluginList.module.css';

const typeText: Record<PluginType, string> = {
  BUILTIN: '内置插件',
  HTTP: 'HTTP 插件',
};

const statusText: Record<PluginStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '已启用',
  DISABLED: '已停用',
  ARCHIVED: '已归档',
};

const statusColor: Record<PluginStatus, string> = {
  DRAFT: 'gold',
  ACTIVE: 'green',
  DISABLED: 'default',
  ARCHIVED: 'red',
};

const iconMap: Record<string, ReactNode> = {
  system_tools: <ToolOutlined />,
  bing_web_search: <SearchOutlined />,
  image_understanding: <FunctionOutlined />,
  link_reader: <CloudServerOutlined />,
  SearchOutlined: <SearchOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  FunctionOutlined: <FunctionOutlined />,
};

function PluginIcon({ plugin }: { plugin: IPlugin }) {
  if (plugin.iconUrl) {
    return <img className={styles.iconImage} src={plugin.iconUrl} alt="" />;
  }

  return (
    <div className={styles.icon}>
      {iconMap[plugin.code] ?? iconMap[plugin.icon ?? ''] ?? <ApiOutlined />}
    </div>
  );
}

export function PluginList() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<PluginStatus | undefined>();
  const [type, setType] = useState<PluginType | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const query = useMemo(
    () =>
      currentWorkspace?.id
        ? {
            workspaceId: currentWorkspace.id,
            page,
            pageSize,
            keyword: keyword.trim() || undefined,
            status,
            type,
          }
        : null,
    [currentWorkspace?.id, keyword, page, status, type],
  );
  const { data, total, loading, error, refresh, toggle } = usePlugins(query);

  const summary = useMemo(() => {
    return {
      active: data.filter((plugin) => plugin.status === 'ACTIVE').length,
      builtin: data.filter((plugin) => plugin.isBuiltin).length,
      tools: data.reduce((sum, plugin) => sum + plugin.toolCount, 0),
    };
  }, [data]);

  const handleToggle = async (plugin: IPlugin) => {
    const nextEnabled = !plugin.enabled;
    try {
      await toggle(plugin.id, nextEnabled);
      message.success(nextEnabled ? '插件已启用' : '插件已停用');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '插件状态更新失败');
    }
  };

  const handleFilterChange = (next: () => void) => {
    setPage(1);
    next();
  };

  if (workspaceLoading || (loading && data.length === 0)) {
    return (
      <section className={styles.page}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <Breadcrumb items={[{ title: '插件' }, { title: '插件市场' }]} />
        <div className={styles.titleRow}>
          <div>
            <h1>插件市场</h1>
            <p>浏览当前工作区可用插件，管理启停状态，并检查每个插件暴露的工具能力。</p>
          </div>
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            刷新
          </Button>
        </div>
      </div>

      <div className={styles.summaryBar}>
        <div>
          <span>当前工作区</span>
          <strong>{currentWorkspace?.name ?? '未选择'}</strong>
        </div>
        <div>
          <span>插件总数</span>
          <strong>{total}</strong>
        </div>
        <div>
          <span>本页启用</span>
          <strong>{summary.active}</strong>
        </div>
        <div>
          <span>内置插件</span>
          <strong>{summary.builtin}</strong>
        </div>
        <div>
          <span>工具能力</span>
          <strong>{summary.tools}</strong>
        </div>
      </div>

      <div className={styles.filters}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索插件名称、编码或描述"
          value={keyword}
          onChange={(event) => handleFilterChange(() => setKeyword(event.target.value))}
        />
        <Select
          allowClear
          placeholder="插件类型"
          value={type}
          options={[
            { label: '内置插件', value: 'BUILTIN' },
            { label: 'HTTP 插件', value: 'HTTP' },
          ]}
          onChange={(value) => handleFilterChange(() => setType(value))}
        />
        <Select
          allowClear
          placeholder="状态"
          value={status}
          options={[
            { label: '草稿', value: 'DRAFT' },
            { label: '已启用', value: 'ACTIVE' },
            { label: '已停用', value: 'DISABLED' },
            { label: '已归档', value: 'ARCHIVED' },
          ]}
          onChange={(value) => handleFilterChange(() => setStatus(value))}
        />
      </div>

      {error ? (
        <div className={styles.center}>
          <Empty description={error}>
            <Button onClick={refresh}>重新加载</Button>
          </Empty>
        </div>
      ) : data.length === 0 ? (
        <div className={styles.center}>
          <Empty description="暂无匹配插件" />
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {data.map((plugin) => (
              <article
                className={styles.card}
                key={plugin.id}
                onClick={() => navigate(`/plugins/${plugin.id}`)}
              >
                <div className={styles.cardTop}>
                  <PluginIcon plugin={plugin} />
                  <div className={styles.cardTitle}>
                    <h2>{plugin.name}</h2>
                    <span>{plugin.code}</span>
                  </div>
                  <Tag color={statusColor[plugin.status]}>{statusText[plugin.status]}</Tag>
                </div>

                <p>{plugin.description}</p>

                <div className={styles.meta}>
                  <Tag>{typeText[plugin.type]}</Tag>
                  {plugin.isBuiltin && <Tag color="blue">内置</Tag>}
                  {!plugin.invocationEnabled && <Tag color="orange">禁止调用</Tag>}
                </div>

                <div className={styles.cardFooter}>
                  <span>{plugin.activeToolCount}/{plugin.toolCount} 个工具可用</span>
                  <span>{plugin.version}</span>
                </div>

                <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
                  <Button onClick={() => navigate(`/plugins/${plugin.id}`)}>查看详情</Button>
                  <Popconfirm
                    title={plugin.enabled ? '停用插件' : '启用插件'}
                    description={plugin.enabled ? '停用后，该插件下的工具将无法被调用。' : '启用后，该插件工具可用于测试和绑定。'}
                    okText="确认"
                    cancelText="取消"
                    onConfirm={() => void handleToggle(plugin)}
                  >
                    <Button type={plugin.enabled ? 'default' : 'primary'} danger={plugin.enabled}>
                      {plugin.enabled ? '停用' : '启用'}
                    </Button>
                  </Popconfirm>
                </div>
              </article>
            ))}
          </div>

          <Pagination
            className={styles.pagination}
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger={false}
            showTotal={(count) => `共 ${count} 个插件`}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
