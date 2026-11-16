// 架构设计页 — MiniCoze 真实技术架构说明
import styles from './index.module.css';

const STACK_LAYERS = [
  {
    key: 'frontend',
    title: '前端层（apps/web）',
    color: '#2563eb',
    items: [
      'React 18 + TypeScript + antd 组件体系',
      '工作流画布（自研节点编辑器：LLM / 插件 / 知识检索 / 条件分支等节点）',
      'Agent 编排页：Persona / 模型 / 工具 / 知识库绑定 / 开场白',
      'SSE 流式对话渲染，支持多附件与多模态消息',
      'Vite 构建，模块化目录（modules/*）+ 统一 API 网关封装（api/http.ts）',
    ],
  },
  {
    key: 'gateway',
    title: '接入层（apps/backend）',
    color: '#7c3aed',
    items: [
      'NestJS 模块化后端，JWT 鉴权 + 工作空间（Workspace）多租户模型',
      '统一响应封装 ApiEnvelope + BusinessException 错误码体系',
      'health 探活：GET /health（liveness）+ GET /health/ready（readiness，检查数据库连通）',
      '分页查询统一 DTO（上限 100 条），全局 ValidationPipe 校验',
    ],
  },
  {
    key: 'runtime',
    title: 'Agent 运行时（agent-runtime）',
    color: '#0891b2',
    items: [
      'ReAct 风格推理循环：模型 → 工具调用 → 结果回填 → 迭代直至产出最终回答',
      'SSE 事件流：token / tool_call / tool_result / done / error 全链路事件',
      '多 Provider 适配：OpenAI / DeepSeek / Anthropic Messages / Gemini v1beta',
      '长期记忆：Conversation.memorySummary 增量摘要，自动压缩早期上下文',
      '运行快照落库（AgentRun + RunStep），支持运行历史回放与排查',
    ],
  },
  {
    key: 'workflow',
    title: '工作流引擎（workflow）',
    color: '#d97706',
    items: [
      '画布 config → Runnable Workflow Definition 的映射与校验（前端 validateWorkflow + 后端执行前校验）',
      '异步执行器 WorkflowAsyncRunner：节点级执行器插件化注册（llm / plugin / knowledge / code / 条件分支）',
      'code 节点沙箱：acorn AST 白名单校验 + node:vm 超时隔离执行',
      'WorkflowRun / WorkflowRunNode 状态机记录每步输入输出与耗时',
    ],
  },
  {
    key: 'knowledge',
    title: '知识库 RAG（knowledge）',
    color: '#16a34a',
    items: [
      '文档上传 → 解析（PDF/Word/Excel/Markdown）→ 分块 → Embedding → 入库',
      '进程内 DocumentTaskQueue（并发 2）异步处理，启动时自动回收中断文档',
      '文档状态机：UPLOADING → PROCESSING → READY / FAILED，前端轮询刷新',
      '检索服务支持向量检索 + 元数据过滤，供 Agent 绑定与工作流 knowledge 节点复用',
    ],
  },
  {
    key: 'plugin',
    title: '插件体系（plugins）',
    color: '#dc2626',
    items: [
      '插件市场：官方插件目录 + 一键安装到工作空间',
      'HTTP 插件：声明式入参 Schema + SSRF 防护（私网地址/协议白名单校验）',
      '凭据管理：加密存储（maskedHint 掩码回显），凭证可被模型 Provider 与 HTTP 插件引用',
      '调用日志：PluginInvocation 记录耗时 / 状态 / 错误摘要',
    ],
  },
  {
    key: 'data',
    title: '数据与基础设施',
    color: '#475569',
    items: [
      'PostgreSQL + Prisma ORM，手写 migration 管理 schema 演进',
      'pnpm monorepo（apps/web + apps/backend），ESLint + tsconfig 严格模式',
      '本地文件存储（file 模块），文档/头像统一上传入口',
      '模型密钥 SecretService 加密落库，运行时解密仅存在于服务内存',
    ],
  },
];

const FLOW_STEPS = [
  { title: '用户输入', desc: 'Web 端发送消息 / 触发工作流运行' },
  { title: '鉴权与上下文', desc: 'JWT 校验 → 加载会话历史与长期记忆摘要' },
  { title: '推理循环', desc: '模型生成 → 工具/插件/知识检索调用 → 结果回填' },
  { title: '流式返回', desc: 'SSE 事件逐 token 推送，工具调用实时可视' },
  { title: '持久化', desc: '消息、运行步骤、插件调用日志异步落库' },
];

export function ArchitecturePage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Architecture</span>
        <h1>架构设计</h1>
        <p>
          MiniCoze 是一个 pnpm monorepo 智能体平台：React 18 前端 + NestJS 后端 +
          PostgreSQL 数据层，支持 Agent 编排、工作流引擎、RAG 知识库与插件体系。
        </p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>请求处理主链路</h2>
        <div className={styles.flow}>
          {FLOW_STEPS.map((step, index) => (
            <div className={styles.flowItem} key={step.title}>
              <div className={styles.flowIndex}>{index + 1}</div>
              <div>
                <h3 className={styles.flowTitle}>{step.title}</h3>
                <p className={styles.flowDesc}>{step.desc}</p>
              </div>
              {index < FLOW_STEPS.length - 1 && (
                <span className={styles.flowArrow}>→</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>分层架构与技术选型</h2>
        <div className={styles.grid}>
          {STACK_LAYERS.map((layer) => (
            <article className={styles.panel} key={layer.key}>
              <h3 className={styles.panelTitle} style={{ color: layer.color }}>
                {layer.title}
              </h3>
              <ul className={styles.panelList}>
                {layer.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>关键设计取舍</h2>
        <div className={styles.tradeoffList}>
          <div className={styles.tradeoff}>
            <strong>进程内任务队列而非 Redis/BullMQ：</strong>
            <span>
              当前单实例部署规模下，进程内并发队列（并发 2）+ 启动回收足够可靠，避免引入额外基础设施。
            </span>
          </div>
          <div className={styles.tradeoff}>
            <strong>node:vm + AST 白名单的轻量沙箱：</strong>
            <span>
              code 节点先用 acorn 做静态语法白名单校验（禁 require/process/constructor 逃逸），再进 vm 限时执行，静态 + 动态双层防护。
            </span>
          </div>
          <div className={styles.tradeoff}>
            <strong>多 Provider 适配层：</strong>
            <span>
              统一 ChatMessage/ToolCall 中间表示，OpenAI / DeepSeek / Anthropic / Gemini 各自实现适配器，新增厂商只需增加一个 Provider 类。
            </span>
          </div>
          <div className={styles.tradeoff}>
            <strong>凭证零明文回显：</strong>
            <span>
              密钥加密存储，接口永远只返回 maskedHint 掩码；更新时可不传 secret 保留原值。
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
