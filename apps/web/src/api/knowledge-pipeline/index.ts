import { knowledgePipelineMock } from './mock';

export * from './mock';
export * from './types';

export const knowledgePipelineApi = {
  getPipeline: knowledgePipelineMock.getPipeline,
  convertPipeline: knowledgePipelineMock.convertPipeline,
  savePipeline: knowledgePipelineMock.savePipeline,
  publishPipeline: knowledgePipelineMock.publishPipeline,
  runPipeline: knowledgePipelineMock.runPipeline,
  runUploadPipeline: knowledgePipelineMock.runUploadPipeline,
  getLatestRun: knowledgePipelineMock.getLatestRun,
  refreshLatestRun: knowledgePipelineMock.refreshLatestRun,
  retryRunStep: knowledgePipelineMock.retryRunStep,
  resetPipeline: knowledgePipelineMock.resetPipeline,
};
