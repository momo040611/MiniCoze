import { useCallback, useState } from 'react';
import {
  testTool,
  type IPluginTool,
  type IToolCallRecord,
  type IToolTestResult,
} from '../../../api/plugins';

interface IUseToolTestResult {
  testing: boolean;
  error: string | null;
  toolCalls: IToolCallRecord[];
  runTest: (
    tool: IPluginTool,
    params: Record<string, unknown>,
  ) => Promise<IToolTestResult>;
  clear: () => void;
}

export function useToolTest(): IUseToolTestResult {
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<IToolCallRecord[]>([]);

  const runTest = useCallback(
    async (tool: IPluginTool, params: Record<string, unknown>) => {
      const callId = `test-${tool.id}-${Date.now()}`;
      const startedAt = new Date().toISOString();

      setTesting(true);
      setError(null);
      setToolCalls((current) =>
        [
          {
            callId,
            toolName: tool.name,
            params,
            status: 'running' as const,
            startedAt,
          },
          ...current,
        ].slice(0, 5),
      );

      try {
        const result = await testTool(tool.id, params, tool.pluginId);
        const finishedAt = new Date().toISOString();

        setToolCalls((current) =>
          current.map((record) =>
            record.callId === callId
              ? {
                  ...record,
                  status: result.success ? 'success' : 'failed',
                  result: result.output ?? result.data,
                  error: result.error ?? undefined,
                  finishedAt,
                }
              : record,
          ),
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '工具测试失败';
        const result: IToolTestResult = { success: false, error: message };

        setError(message);
        setToolCalls((current) =>
          current.map((record) =>
            record.callId === callId
              ? {
                  ...record,
                  status: 'failed',
                  error: message,
                  finishedAt: new Date().toISOString(),
                }
              : record,
          ),
        );
        return result;
      } finally {
        setTesting(false);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setToolCalls([]);
    setError(null);
  }, []);

  return { testing, error, toolCalls, runTest, clear };
}
