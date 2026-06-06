import { useCallback, useState } from 'react';
import { testTool, type IToolTestResult } from '../../../api/plugins';

export interface IToolTestRecord extends IToolTestResult {
  id: string;
  params: Record<string, unknown>;
  createdAt: string;
}

interface IUseToolTestResult {
  testing: boolean;
  error: string | null;
  records: IToolTestRecord[];
  runTest: (toolId: string, params: Record<string, unknown>, pluginId?: string) => Promise<IToolTestResult>;
  clear: () => void;
}

export function useToolTest(): IUseToolTestResult {
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<IToolTestRecord[]>([]);

  const runTest = useCallback(async (toolId: string, params: Record<string, unknown>, pluginId?: string) => {
    setTesting(true);
    setError(null);
    try {
      const result = await testTool(toolId, params, pluginId);
      setRecords((current) => [
        {
          ...result,
          id: `${toolId}-${Date.now()}`,
          params,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 5));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '工具测试失败';
      const result: IToolTestResult = { success: false, error: message };
      setError(message);
      setRecords((current) => [
        {
          ...result,
          id: `${toolId}-${Date.now()}`,
          params,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 5));
      return result;
    } finally {
      setTesting(false);
    }
  }, []);

  const clear = useCallback(() => {
    setRecords([]);
    setError(null);
  }, []);

  return { testing, error, records, runTest, clear };
}
