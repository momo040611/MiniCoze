// 工作流示例模板：一键创建即可在画布中打开，可直接运行或稍作配置后运行。
import type { WorkflowCanvasData } from '../../api/workflows';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  /** 运行依赖说明，展示在模板卡片上 */
  requirement: string;
  /** 是否可直接运行（不依赖模型 / 知识库） */
  readyToRun: boolean;
  tags: string[];
  canvasData: WorkflowCanvasData;
}

// 模板一：文本统计与改写 —— 只用代码节点，开箱即跑，不依赖任何外部服务。
const textStatsCanvas: WorkflowCanvasData = {
  nodes: [
    {
      id: 'start_1',
      type: 'start',
      meta: { position: { x: 100, y: 260 } },
      data: {
        nodeMeta: { title: '开始节点', description: '接收用户输入文本' },
        outputs: [{ label: '用户输入', type: 'string', name: 'query' }],
      },
    },
    {
      id: 'code_1',
      type: 'code',
      meta: { position: { x: 420, y: 260 } },
      data: {
        nodeMeta: {
          title: '文本统计',
          description: '统计字符数、词数并转大写',
        },
        inputs: [{ label: '入参', type: 'object', name: 'params' }],
        outputs: [{ label: '统计结果', type: 'object', name: 'result' }],
        config: {
          code: [
            "const text = String(input.text ?? '');",
            'const trimmed = text.trim();',
            'const words = trimmed ? trimmed.split(\' \').filter(Boolean).length : 0;',
            'return {',
            '  length: text.length,',
            '  words,',
            '  upper: text.toUpperCase(),',
            '};',
          ].join('\n'),
          paramsJson: '{"text": "{{input.query}}"}',
        },
      },
    },
    {
      id: 'end_1',
      type: 'end',
      meta: { position: { x: 760, y: 260 } },
      data: {
        nodeMeta: { title: '结束节点', description: '输出统计结果' },
        inputs: [{ label: '输入', type: 'string', name: 'content' }],
        config: {
          outputMode: '返回变量',
          resultExpression: '',
          outputFieldsJson:
            '{"字符数": "{{code_1.length}}", "词数": "{{code_1.words}}", "大写结果": "{{code_1.upper}}"}',
        },
      },
    },
  ],
  edges: [
    { sourceNodeID: 'start_1', targetNodeID: 'code_1', source: 'start_1', target: 'code_1' },
    { sourceNodeID: 'code_1', targetNodeID: 'end_1', source: 'code_1', target: 'end_1' },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

// 模板二：知识库问答 —— 检索知识库片段后交给模型总结（需先创建知识库并上传文档）。
const knowledgeQaCanvas: WorkflowCanvasData = {
  nodes: [
    {
      id: 'start_1',
      type: 'start',
      meta: { position: { x: 100, y: 260 } },
      data: {
        nodeMeta: { title: '开始节点', description: '接收用户问题' },
        outputs: [{ label: '用户问题', type: 'string', name: 'query' }],
      },
    },
    {
      id: 'knowledge_1',
      type: 'knowledge',
      meta: { position: { x: 400, y: 260 } },
      data: {
        nodeMeta: { title: '知识检索', description: '召回相关文档片段' },
        inputs: [{ label: '查询参数', type: 'string', name: 'query' }],
        outputs: [
          { label: '检索结果', type: 'array', name: 'results' },
          { label: '拼接文本', type: 'string', name: 'summary' },
        ],
        config: {
          knowledgeBaseIds: [],
          query: '{{input.query}}',
          topK: 3,
        },
      },
    },
    {
      id: 'llm_1',
      type: 'llm',
      meta: { position: { x: 720, y: 260 } },
      data: {
        nodeMeta: { title: '生成回答', description: '基于检索片段作答' },
        inputs: [{ label: '输入', type: 'string', name: 'query' }],
        outputs: [{ label: '输出', type: 'string', name: 'content' }],
        config: {
          model: 'deepseek-chat',
          temperature: 0.3,
          systemPrompt: '你是企业知识库助手，只根据给定资料回答，资料不足时明确说明。',
          prompt:
            '参考资料：\n{{knowledge_1.summary}}\n\n用户问题：{{input.query}}\n\n请用简洁的中文回答。',
        },
      },
    },
    {
      id: 'end_1',
      type: 'end',
      meta: { position: { x: 1040, y: 260 } },
      data: {
        nodeMeta: { title: '结束节点', description: '输出模型回答' },
        inputs: [{ label: '输入', type: 'string', name: 'content' }],
        config: {
          outputMode: '返回变量',
          resultExpression: '{{llm_1.content}}',
          outputFieldsJson: '',
        },
      },
    },
  ],
  edges: [
    { sourceNodeID: 'start_1', targetNodeID: 'knowledge_1', source: 'start_1', target: 'knowledge_1' },
    { sourceNodeID: 'knowledge_1', targetNodeID: 'llm_1', source: 'knowledge_1', target: 'llm_1' },
    { sourceNodeID: 'llm_1', targetNodeID: 'end_1', source: 'llm_1', target: 'end_1' },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

// 模板三：意图分流 —— 模型判断意图后按条件节点分流到不同话术（演示条件分支路由）。
const intentRoutingCanvas: WorkflowCanvasData = {
  nodes: [
    {
      id: 'start_1',
      type: 'start',
      meta: { position: { x: 80, y: 300 } },
      data: {
        nodeMeta: { title: '开始节点', description: '接收用户留言' },
        outputs: [{ label: '用户留言', type: 'string', name: 'query' }],
      },
    },
    {
      id: 'llm_1',
      type: 'llm',
      meta: { position: { x: 360, y: 300 } },
      data: {
        nodeMeta: { title: '意图识别', description: '输出一句话意图标签' },
        inputs: [{ label: '输入', type: 'string', name: 'query' }],
        outputs: [{ label: '输出', type: 'string', name: 'content' }],
        config: {
          model: 'deepseek-chat',
          temperature: 0,
          systemPrompt: '你是客服意图分类器，只输出一个标签，不要解释。',
          prompt:
            '用户留言：{{input.query}}\n\n请判断意图，只能输出以下之一：退款申请 / 物流查询 / 其他',
        },
      },
    },
    {
      id: 'condition_1',
      type: 'condition',
      meta: { position: { x: 680, y: 300 } },
      data: {
        nodeMeta: { title: '是否退款', description: '命中退款意图走上方分支' },
        inputs: [{ label: '输入', type: 'string', name: 'value' }],
        outputs: [
          { label: '是', type: 'boolean', name: 'trueBranch' },
          { label: '否', type: 'boolean', name: 'falseBranch' },
        ],
        config: {
          leftValue: '{{llm_1.content}}',
          operator: 'contains',
          compareValue: '退款',
          expression: '',
        },
      },
    },
    {
      id: 'end_refund',
      type: 'end',
      meta: { position: { x: 1000, y: 180 } },
      data: {
        nodeMeta: { title: '退款话术', description: '条件成立分支' },
        inputs: [{ label: '输入', type: 'string', name: 'content' }],
        config: {
          outputMode: '返回变量',
          resultExpression: '',
          outputFieldsJson: '{"意图": "退款申请", "回复": "已为您登记退款申请，1-3 个工作日内处理。"}',
        },
      },
    },
    {
      id: 'end_other',
      type: 'end',
      meta: { position: { x: 1000, y: 420 } },
      data: {
        nodeMeta: { title: '通用话术', description: '条件不成立分支' },
        inputs: [{ label: '输入', type: 'string', name: 'content' }],
        config: {
          outputMode: '返回变量',
          resultExpression: '',
          outputFieldsJson: '{"意图": "其他", "回复": "已收到您的留言，客服会尽快联系您。"}',
        },
      },
    },
  ],
  edges: [
    { sourceNodeID: 'start_1', targetNodeID: 'llm_1', source: 'start_1', target: 'llm_1' },
    { sourceNodeID: 'llm_1', targetNodeID: 'condition_1', source: 'llm_1', target: 'condition_1' },
    {
      sourceNodeID: 'condition_1',
      targetNodeID: 'end_refund',
      source: 'condition_1',
      target: 'end_refund',
      sourcePort: 'true',
      sourcePortID: 'true',
    },
    {
      sourceNodeID: 'condition_1',
      targetNodeID: 'end_other',
      source: 'condition_1',
      target: 'end_other',
      sourcePort: 'false',
      sourcePortID: 'false',
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'text-stats',
    name: '文本统计与改写',
    description: '开始 → 代码执行 → 结束：统计字符数、词数并把文本转大写，展示代码节点与输出映射。',
    requirement: '无需额外配置，创建后可直接运行',
    readyToRun: true,
    tags: ['代码节点', '开箱即跑'],
    canvasData: textStatsCanvas,
  },
  {
    id: 'knowledge-qa',
    name: '知识库问答',
    description: '开始 → 知识检索 → 大模型 → 结束：先召回知识库片段，再让模型依据资料回答。',
    requirement: '需要先创建知识库并上传文档，同时配置可用的模型服务',
    readyToRun: false,
    tags: ['RAG', '知识检索'],
    canvasData: knowledgeQaCanvas,
  },
  {
    id: 'intent-routing',
    name: '客诉意图分流',
    description: '开始 → 意图识别 → 条件分支 → 两条结束话术：演示条件节点按端口路由不同分支。',
    requirement: '需要配置可用的模型服务',
    readyToRun: false,
    tags: ['条件分支', '多结束节点'],
    canvasData: intentRoutingCanvas,
  },
];
