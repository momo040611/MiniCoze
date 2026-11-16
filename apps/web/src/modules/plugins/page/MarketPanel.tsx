import { App, Button, Empty, Input, Skeleton, Tag, Tooltip } from 'antd';
import {
  ApiOutlined,
  CheckCircleFilled,
  DownloadOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMarketCatalog,
  installMarketPlugin,
  type IMarketPlugin,
} from '../../../api/plugins';
import { useWorkspace } from '../../workspace/use-workspace';
import styles from './PluginList.module.css';
import marketStyles from './MarketPanel.module.css';

export function MarketPanel() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [items, setItems] = useState<IMarketPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [installingCode, setInstallingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);
    try {
      const catalog = await getMarketCatalog(currentWorkspace.id);
      setItems(catalog.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载插件市场失败');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(kw) ||
        item.code.toLowerCase().includes(kw) ||
        item.description.toLowerCase().includes(kw),
    );
  }, [items, keyword]);

  const handleInstall = async (item: IMarketPlugin) => {
    if (!currentWorkspace?.id) return;
    try {
      setInstallingCode(item.code);
      const result = await installMarketPlugin(currentWorkspace.id, item.code);
      message.success(`插件「${result.name}」已安装到工作区`);
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '安装失败');
    } finally {
      setInstallingCode(null);
    }
  };

  if (workspaceLoading || (loading && items.length === 0)) {
    return (
      <div className={styles.page}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <div className={marketStyles.panel}>
      <div className={styles.filters}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索插件名称、编码或描述"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <span className={marketStyles.hint}>
          共 {items.length} 个官方插件，安装后即可在「已安装」列表中绑定 Agent
        </span>
      </div>

      {error ? (
        <div className={styles.center}>
          <Empty description={error}>
            <Button onClick={() => void load()}>重新加载</Button>
          </Empty>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.center}>
          <Empty description="没有匹配的插件" />
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((item) => (
            <article className={styles.card} key={item.code}>
              <div className={styles.cardTop}>
                <div className={styles.icon}>
                  <ApiOutlined />
                </div>
                <div className={styles.cardTitle}>
                  <h2>{item.name}</h2>
                  <span>{item.code}</span>
                </div>
                {item.installed ? (
                  <Tooltip title="已安装到当前工作区">
                    <Tag color="green" icon={<CheckCircleFilled />}>
                      已安装
                    </Tag>
                  </Tooltip>
                ) : (
                  <Tag color="gold">未安装</Tag>
                )}
              </div>

              <p>{item.description}</p>

              <div className={styles.meta}>
                <Tag color="blue">官方插件</Tag>
                <Tag icon={<ToolOutlined />}>{item.tools.length} 个工具</Tag>
                <Tag>{item.version}</Tag>
              </div>

              <ul className={marketStyles.toolList}>
                {item.tools.map((tool) => (
                  <li key={tool.code}>
                    <strong>{tool.name}</strong>
                    <span>{tool.description}</span>
                  </li>
                ))}
              </ul>

              <div className={styles.actions}>
                {item.installed ? (
                  <>
                    <Button
                      type="primary"
                      ghost
                      onClick={() => navigate(`/plugins/${item.pluginId}`)}
                    >
                      查看详情
                    </Button>
                    <Button icon={<CheckCircleFilled />} disabled>
                      已安装
                    </Button>
                  </>
                ) : (
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    loading={installingCode === item.code}
                    onClick={() => void handleInstall(item)}
                  >
                    安装到工作区
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
