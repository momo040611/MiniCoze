import { useCallback, useEffect, useState } from 'react';
import {
  getPlugins,
  togglePlugin,
  type IGetPluginsParams,
  type IPaginatedPlugins,
  type IPlugin,
} from '../../../api/plugins';

interface IUsePluginsResult {
  data: IPlugin[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggle: (pluginId: string, enabled: boolean) => Promise<void>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '插件列表加载失败';
}

export function usePlugins(params: IGetPluginsParams | null): IUsePluginsResult {
  const [data, setData] = useState<IPlugin[]>([]);
  const [pagination, setPagination] = useState<Pick<IPaginatedPlugins, 'total' | 'page' | 'pageSize'>>({
    total: 0,
    page: 1,
    pageSize: 12,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!params?.workspaceId) {
      setData([]);
      setPagination((current) => ({ ...current, total: 0 }));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getPlugins(params);
      setData(result.list);
      setPagination({
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setData([]);
      setPagination((current) => ({ ...current, total: 0 }));
    } finally {
      setLoading(false);
    }
  }, [params]);

  const toggle = useCallback(async (pluginId: string, enabled: boolean) => {
    const updated = await togglePlugin(pluginId, enabled);
    setData((current) =>
      current.map((plugin) => (plugin.id === pluginId ? { ...plugin, ...updated } : plugin)),
    );
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data,
    total: pagination.total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    loading,
    error,
    refresh,
    toggle,
  };
}
