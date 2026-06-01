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
  {
    code: 'bing_web_search',
    name: '必应网页搜索',
    description:
      '提供实时网页检索、网页摘要与分页查询能力，适合获取最新资讯和时效性资料。',
    version: 'v1.0.0',
    tools: [
      {
        code: 'web_search',
        name: '全网检索',
        description: '按关键词搜索全网网页并返回结构化结果列表。',
        handler: 'bing_web_search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            count: { type: 'integer' },
            mkt: { type: 'string' },
            freshness: {
              type: 'string',
              enum: ['Day', 'Week', 'Month'],
            },
            safeSearch: {
              type: 'string',
              enum: ['Off', 'Moderate', 'Strict'],
            },
          },
          required: ['query'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            count: { type: 'integer' },
            offset: { type: 'integer' },
            totalEstimatedMatches: { type: 'integer' },
            results: { type: 'array' },
          },
        },
      },
      {
        code: 'page_summary',
        name: '网页摘要',
        description: '抓取指定网页并提取标题、描述与正文预览。',
        handler: 'bing_page_summary',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            maxChars: { type: 'integer' },
          },
          required: ['url'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            summary: { type: 'string' },
            contentPreview: { type: 'string' },
          },
        },
      },
      {
        code: 'paged_search',
        name: '分页查询',
        description: '按页码和每页数量翻页检索网页结果。',
        handler: 'bing_paged_search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            mkt: { type: 'string' },
            freshness: {
              type: 'string',
              enum: ['Day', 'Week', 'Month'],
            },
            safeSearch: {
              type: 'string',
              enum: ['Off', 'Moderate', 'Strict'],
            },
          },
          required: ['query'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            count: { type: 'integer' },
            offset: { type: 'integer' },
            totalEstimatedMatches: { type: 'integer' },
            hasMore: { type: 'boolean' },
            results: { type: 'array' },
          },
        },
      },
    ],
  },
];
