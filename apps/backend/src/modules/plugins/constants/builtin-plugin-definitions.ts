interface BuiltinPluginDefinition {
  code: string;
  name: string;
  description: string;
  version: string;
  tools: Array<{
    code: string;
    name: string;
    description: string;
    handler: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
  }>;
}

export const BUILTIN_PLUGIN_DEFINITIONS: BuiltinPluginDefinition[] = [
  {
    code: 'system_tools',
    name: '系统工具',
    description: '提供时间查询、文本回显等基础内置能力。',
    version: 'v1.0.0',
    tools: [
      {
        code: 'time_now',
        name: '当前时间',
        description: '获取当前系统时间。',
        handler: 'time_now',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        outputSchema: {
          type: 'object',
          properties: {
            now: { type: 'string' },
          },
        },
      },
      {
        code: 'echo_text',
        name: '文本回显',
        description: '将传入文本原样返回，便于调试工具调用链路。',
        handler: 'echo_text',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
          required: ['text'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
        },
      },
    ],
  },
];
