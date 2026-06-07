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
  {
    code: 'image_understanding',
    name: '图片理解',
    description:
      '提供图片 OCR、截图解析、图表数据分析与画面内容描述能力，适合图文问答场景。',
    version: 'v1.0.0',
    tools: [
      {
        code: 'image_ocr',
        name: '图片 OCR 文字识别',
        description: '识别图片中的文字内容，可用于试卷、文档、截图文本提取。',
        handler: 'image_ocr',
        inputSchema: {
          type: 'object',
          properties: {
            imageUrl: { type: 'string' },
            fileId: { type: 'string' },
            detail: {
              type: 'string',
              enum: ['low', 'high', 'auto'],
            },
            question: { type: 'string' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            summary: { type: 'string' },
            languageHints: { type: 'array' },
            answer: { type: 'string' },
            raw: { type: 'string' },
          },
        },
      },
      {
        code: 'screenshot_parse',
        name: '截图解析',
        description:
          '解析产品截图、代码截图或界面截图中的结构、文本与关键元素。',
        handler: 'screenshot_parse',
        inputSchema: {
          type: 'object',
          properties: {
            imageUrl: { type: 'string' },
            fileId: { type: 'string' },
            detail: {
              type: 'string',
              enum: ['low', 'high', 'auto'],
            },
            question: { type: 'string' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            detectedText: { type: 'array' },
            uiElements: { type: 'array' },
            observations: { type: 'array' },
            answer: { type: 'string' },
            raw: { type: 'string' },
          },
        },
      },
      {
        code: 'chart_data_analysis',
        name: '图表数据分析',
        description:
          '识别图表类型、关键数据点、趋势与结论，适合分析统计图与业务图表。',
        handler: 'chart_data_analysis',
        inputSchema: {
          type: 'object',
          properties: {
            imageUrl: { type: 'string' },
            fileId: { type: 'string' },
            detail: {
              type: 'string',
              enum: ['low', 'high', 'auto'],
            },
            question: { type: 'string' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            chartType: { type: 'string' },
            title: { type: 'string' },
            axes: { type: 'array' },
            series: { type: 'array' },
            keyFindings: { type: 'array' },
            answer: { type: 'string' },
            raw: { type: 'string' },
          },
        },
      },
      {
        code: 'scene_description',
        name: '画面内容描述',
        description:
          '描述图片中的主体、场景、动作与文字信息，适合通用图像理解。',
        handler: 'scene_description',
        inputSchema: {
          type: 'object',
          properties: {
            imageUrl: { type: 'string' },
            fileId: { type: 'string' },
            detail: {
              type: 'string',
              enum: ['low', 'high', 'auto'],
            },
            question: { type: 'string' },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            objects: { type: 'array' },
            actions: { type: 'array' },
            textInImage: { type: 'array' },
            answer: { type: 'string' },
            raw: { type: 'string' },
          },
        },
      },
    ],
  },
  {
    code: 'link_reader',
    name: '链接读取',
    description:
      '提供 URL 全文抓取、网页内容清洗与公众号/博客解析能力，适合对网页资料做深度阅读。',
    version: 'v1.0.0',
    tools: [
      {
        code: 'url_full_fetch',
        name: 'URL 全文抓取',
        description: '抓取网页主要文本内容，尽量保留原始正文信息。',
        handler: 'url_full_fetch',
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
            finalUrl: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            siteName: { type: 'string' },
            sourceType: { type: 'string' },
            contentType: { type: 'string' },
            headings: { type: 'array' },
            content: { type: 'string' },
            wordCount: { type: 'integer' },
          },
        },
      },
      {
        code: 'web_content_clean',
        name: '网页内容清洗',
        description:
          '对网页正文去噪、去导航、去版权提示，输出更适合模型阅读的内容。',
        handler: 'web_content_clean',
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
            finalUrl: { type: 'string' },
            title: { type: 'string' },
            cleanedContent: { type: 'string' },
            paragraphs: { type: 'array' },
            headings: { type: 'array' },
            wordCount: { type: 'integer' },
          },
        },
      },
      {
        code: 'article_parse',
        name: '公众号 / 博客解析',
        description:
          '提取文章标题、作者、发布时间、段落结构与正文，适合公众号和博客链接。',
        handler: 'article_parse',
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
            finalUrl: { type: 'string' },
            sourceType: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            siteName: { type: 'string' },
            author: { type: 'string' },
            publishDate: { type: 'string' },
            headings: { type: 'array' },
            content: { type: 'string' },
            excerpt: { type: 'string' },
            isWechatArticle: { type: 'boolean' },
            isBlogLike: { type: 'boolean' },
          },
        },
      },
    ],
  },
];
