import type {
  ApiResponse,
  KnowledgePipeline,
  PipelineLog,
  PipelineRun,
  PipelineRunStep,
  PipelineStep,
  PipelineStepType,
  SavePipelinePayload,
} from './types';

type PipelineStore = {
  pipelines: KnowledgePipeline[];
  runs: PipelineRun[];
};

const STORAGE_KEY = 'miniCoze_mock_knowledge_pipeline_store_v1';

function now() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { code: 0, message, data };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const pipelineStepText: Record<PipelineStepType, string> = {
  file_upload: 'File Upload',
  document_parse: 'Document Parser',
  text_clean: 'Text Cleaner',
  document_chunk: 'Chunk Splitter',
  metadata_extract: 'Metadata Extractor',
  embedding: 'Embedding',
  vector_store: 'Vector Store',
  retrieval_test: 'Retrieval Test',
};

export function createDefaultSteps(): PipelineStep[] {
  return [
    {
      id: 'step-file-upload',
      type: 'file_upload',
      name: pipelineStepText.file_upload,
      description: '接收本地文件、文本或 URL 数据源，并进行基础校验。',
      enabled: true,
      retryEnabled: true,
      retryTimes: 1,
      config: {},
    },
    {
      id: 'step-document-parse',
      type: 'document_parse',
      name: pipelineStepText.document_parse,
      description: '解析 PDF、DOCX、TXT、Markdown 等文档，抽取正文、表格和图片信息。',
      enabled: true,
      retryEnabled: true,
      retryTimes: 2,
      config: {
        ocrEnabled: true,
        preserveTable: true,
        extractImages: false,
        supportedFormats: ['PDF', 'DOCX', 'TXT', 'Markdown'],
      },
    },
    {
      id: 'step-text-clean',
      type: 'text_clean',
      name: pipelineStepText.text_clean,
      description: '清理噪声文本，统一空白字符和常见敏感片段。',
      enabled: true,
      retryEnabled: true,
      retryTimes: 1,
      config: {
        removeBlankLines: true,
        removeUrls: false,
        removeEmails: true,
        mergeSpaces: true,
      },
    },
    {
      id: 'step-document-chunk',
      type: 'document_chunk',
      name: pipelineStepText.document_chunk,
      description: '按照结构或语义进行分段，为后续检索生成稳定片段。',
      enabled: true,
      retryEnabled: true,
      retryTimes: 2,
      config: {
        mode: 'semantic',
        chunkSize: 800,
        chunkOverlap: 100,
        parentChildEnabled: true,
      },
    },
    {
      id: 'step-metadata-extract',
      type: 'metadata_extract',
      name: pipelineStepText.metadata_extract,
      description: '抽取来源、分类、语言、章节等元数据，用于过滤和召回增强。',
      enabled: true,
      retryEnabled: false,
      retryTimes: 0,
      config: {},
    },
    {
      id: 'step-embedding',
      type: 'embedding',
      name: pipelineStepText.embedding,
      description: '将分段文本批量转换为向量表示。',
      enabled: true,
      retryEnabled: true,
      retryTimes: 3,
      config: {
        model: 'text-embedding-3-large',
        batchSize: 32,
        retryTimes: 3,
      },
    },
    {
      id: 'step-vector-store',
      type: 'vector_store',
      name: pipelineStepText.vector_store,
      description: '写入向量库并建立适合当前知识库的索引。',
      enabled: true,
      retryEnabled: true,
      retryTimes: 2,
      config: {
        type: 'Mock',
        indexMode: 'high_quality',
        hybridSearchEnabled: true,
      },
    },
    {
      id: 'step-retrieval-test',
      type: 'retrieval_test',
      name: pipelineStepText.retrieval_test,
      description: '使用样例问题验证召回效果、分数阈值和 Rerank 设置。',
      enabled: true,
      retryEnabled: false,
      retryTimes: 0,
      config: {
        topK: 5,
        scoreThreshold: 0.35,
        rerankEnabled: true,
      },
    },
  ];
}

function createSeedStore(): PipelineStore {
  return { pipelines: [], runs: [] };
}

function readStore(): PipelineStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedStore();
    const parsed = JSON.parse(raw) as Partial<PipelineStore>;
    return {
      pipelines: parsed.pipelines ?? [],
      runs: parsed.runs ?? [],
    };
  } catch {
    return createSeedStore();
  }
}

function writeStore(store: PipelineStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function createDefaultPipeline(knowledgeBaseId: string, knowledgeBaseName: string): KnowledgePipeline {
  const timestamp = now();
  return {
    id: uid('kpipe'),
    name: `${knowledgeBaseName || '默认知识库'}生产流水线`,
    description: '面向 RAG 知识库的标准文档处理流程，覆盖解析、清洗、分段、向量化、入库和检索验证。',
    knowledgeBaseId,
    knowledgeBaseName,
    status: 'draft',
    version: 1,
    updatedAt: timestamp,
    steps: createDefaultSteps(),
  };
}

function ensurePipeline(store: PipelineStore, knowledgeBaseId: string, knowledgeBaseName = '默认知识库') {
  let pipeline = store.pipelines.find((item) => item.knowledgeBaseId === knowledgeBaseId);
  if (!pipeline) {
    pipeline = createDefaultPipeline(knowledgeBaseId, knowledgeBaseName);
    store.pipelines.unshift(pipeline);
  }
  return pipeline;
}

function makeStepLog(runId: string, stepId: string, message: string, level: PipelineLog['level'] = 'info'): PipelineLog {
  return {
    id: uid('plog'),
    runId,
    stepId,
    level,
    message,
    createdAt: now(),
  };
}

function createRunFromPipeline(pipeline: KnowledgePipeline): PipelineRun {
  const runId = uid('prun');
  const steps: PipelineRunStep[] = pipeline.steps.map((step, index) => {
    if (!step.enabled) {
      return {
        id: uid('rstep'),
        stepId: step.id,
        type: step.type,
        name: step.name,
        status: 'skipped',
        retryCount: 0,
      };
    }

    return {
      id: uid('rstep'),
      stepId: step.id,
      type: step.type,
      name: step.name,
      status: index === 0 ? 'running' : 'pending',
      startedAt: index === 0 ? now() : undefined,
      retryCount: 0,
    };
  });

  const firstStep = steps.find((step) => step.status === 'running');

  return {
    id: runId,
    pipelineId: pipeline.id,
    knowledgeBaseId: pipeline.knowledgeBaseId,
    pipelineName: pipeline.name,
    pipelineVersion: pipeline.version,
    status: firstStep ? 'running' : 'success',
    progress: firstStep ? 0 : 100,
    startedAt: now(),
    updatedAt: now(),
    steps,
    logs: firstStep ? [makeStepLog(runId, firstStep.stepId, `${firstStep.name} 开始执行`)] : [],
  };
}

function createUploadRun(pipeline: KnowledgePipeline, failed = false): PipelineRun {
  const run = createRunFromPipeline(pipeline);
  const firstStep = run.steps.find((step) => step.status === 'running' || step.status === 'pending');
  if (failed && firstStep) {
    firstStep.status = 'failed';
    firstStep.startedAt = firstStep.startedAt ?? now();
    firstStep.endedAt = now();
    firstStep.failureReason = '文件上传或解析失败，请检查文件类型、大小或文档内容。';
    run.status = 'failed';
    run.progress = 0;
    run.updatedAt = now();
    run.logs.unshift(makeStepLog(run.id, firstStep.stepId, `${firstStep.name} 执行失败：${firstStep.failureReason}`, 'error'));
  }
  return run;
}

function recalculateRun(run: PipelineRun) {
  const effectiveSteps = run.steps.filter((step) => step.status !== 'skipped');
  const doneSteps = effectiveSteps.filter((step) => step.status === 'success').length;
  const failed = effectiveSteps.some((step) => step.status === 'failed');
  const running = effectiveSteps.some((step) => step.status === 'running');
  run.progress = effectiveSteps.length === 0 ? 100 : Math.round((doneSteps / effectiveSteps.length) * 100);
  run.status = failed ? 'failed' : running ? 'running' : run.progress >= 100 ? 'success' : 'pending';
  run.updatedAt = now();
}

function advanceRun(run: PipelineRun) {
  const runningStep = run.steps.find((step) => step.status === 'running');
  if (runningStep) {
    const failed = runningStep.type === 'embedding' && runningStep.retryCount === 0 && Math.random() < 0.2;
    if (failed) {
      runningStep.status = 'failed';
      runningStep.endedAt = now();
      runningStep.failureReason = 'Embedding 服务短暂不可用，请稍后重试。';
      run.logs.unshift(makeStepLog(run.id, runningStep.stepId, `${runningStep.name} 执行失败：${runningStep.failureReason}`, 'error'));
      recalculateRun(run);
      return;
    }

    runningStep.status = 'success';
    runningStep.endedAt = now();
    runningStep.durationMs = 850 + Math.floor(Math.random() * 1600);
    run.logs.unshift(makeStepLog(run.id, runningStep.stepId, `${runningStep.name} 执行完成`));
  }

  const nextStep = run.steps.find((step) => step.status === 'pending');
  if (nextStep) {
    nextStep.status = 'running';
    nextStep.startedAt = now();
    run.logs.unshift(makeStepLog(run.id, nextStep.stepId, `${nextStep.name} 开始执行`));
  }

  recalculateRun(run);
}

function applyPipelinePayload(current: KnowledgePipeline, payload: SavePipelinePayload) {
  Object.assign(current, {
    ...payload,
    status: payload.status ?? current.status,
    convertedAt: current.convertedAt,
    updatedAt: now(),
  });
}

export const knowledgePipelineMock = {
  async getPipeline(knowledgeBaseId: string, knowledgeBaseName?: string) {
    const store = readStore();
    const pipeline = ensurePipeline(store, knowledgeBaseId, knowledgeBaseName);
    writeStore(store);
    return ok(clone(pipeline));
  },

  async convertPipeline(knowledgeBaseId: string, knowledgeBaseName?: string) {
    const store = readStore();
    const pipeline = ensurePipeline(store, knowledgeBaseId, knowledgeBaseName);
    pipeline.convertedAt = pipeline.convertedAt ?? now();
    pipeline.updatedAt = now();
    writeStore(store);
    return ok(clone(pipeline), 'converted');
  },

  async savePipeline(payload: SavePipelinePayload) {
    const store = readStore();
    const current = ensurePipeline(store, payload.knowledgeBaseId, payload.knowledgeBaseName);
    applyPipelinePayload(current, { ...payload, status: payload.status ?? 'draft' });
    writeStore(store);
    return ok(clone(current), 'saved');
  },

  async publishPipeline(payload: SavePipelinePayload) {
    const store = readStore();
    const current = ensurePipeline(store, payload.knowledgeBaseId, payload.knowledgeBaseName);
    applyPipelinePayload(current, { ...payload, status: 'published' });
    current.convertedAt = current.convertedAt ?? now();
    current.version += 1;
    const run = createRunFromPipeline(current);
    store.runs.unshift(run);
    writeStore(store);
    return ok({ pipeline: clone(current), run: clone(run) }, 'published');
  },

  async runPipeline(knowledgeBaseId: string, knowledgeBaseName?: string) {
    const store = readStore();
    const pipeline = ensurePipeline(store, knowledgeBaseId, knowledgeBaseName);
    pipeline.convertedAt = pipeline.convertedAt ?? now();
    pipeline.updatedAt = now();
    const run = createRunFromPipeline(pipeline);
    store.runs.unshift(run);
    writeStore(store);
    return ok(clone(run), 'running');
  },

  async runUploadPipeline(knowledgeBaseId: string, knowledgeBaseName?: string, failed = false) {
    const store = readStore();
    const pipeline = ensurePipeline(store, knowledgeBaseId, knowledgeBaseName);
    pipeline.convertedAt = pipeline.convertedAt ?? now();
    pipeline.updatedAt = now();
    const run = createUploadRun(pipeline, failed);
    store.runs.unshift(run);
    writeStore(store);
    return ok(clone(run), failed ? 'failed' : 'running');
  },

  async getLatestRun(knowledgeBaseId: string) {
    const store = readStore();
    const run = store.runs.find((item) => item.knowledgeBaseId === knowledgeBaseId) ?? null;
    return ok(clone(run));
  },

  async refreshLatestRun(knowledgeBaseId: string) {
    const store = readStore();
    const run = store.runs.find((item) => item.knowledgeBaseId === knowledgeBaseId) ?? null;
    if (run && run.status === 'running') {
      advanceRun(run);
      writeStore(store);
    }
    return ok(clone(run));
  },

  async retryRunStep(runId: string, stepId: string) {
    const store = readStore();
    const run = store.runs.find((item) => item.id === runId) ?? null;
    const step = run?.steps.find((item) => item.stepId === stepId);
    if (run && step && step.status === 'failed') {
      step.status = 'running';
      step.startedAt = now();
      step.endedAt = undefined;
      step.failureReason = undefined;
      step.retryCount += 1;
      run.logs.unshift(makeStepLog(run.id, step.stepId, `${step.name} 正在重试，第 ${step.retryCount} 次`));
      recalculateRun(run);
      writeStore(store);
    }
    return ok(clone(run));
  },

  async resetPipeline(knowledgeBaseId: string, knowledgeBaseName?: string) {
    const store = readStore();
    const previous = store.pipelines.find((item) => item.knowledgeBaseId === knowledgeBaseId);
    store.pipelines = store.pipelines.filter((item) => item.knowledgeBaseId !== knowledgeBaseId);
    const pipeline = ensurePipeline(store, knowledgeBaseId, knowledgeBaseName);
    pipeline.convertedAt = previous?.convertedAt;
    pipeline.status = previous?.convertedAt ? 'draft' : pipeline.status;
    writeStore(store);
    return ok(clone(pipeline), 'reset');
  },
};
