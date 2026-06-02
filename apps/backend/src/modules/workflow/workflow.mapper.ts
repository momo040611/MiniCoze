import { Injectable } from '@nestjs/common';
import { Prisma, Workflow, WorkflowRun, WorkflowRunNode, WorkflowVersion } from '@prisma/client';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { WorkflowResponse } from './types/workflow-response.type';
import {
  WorkflowRunNodeResponse,
  WorkflowRunResponse,
} from './types/workflow-run-response.type';
import { WorkflowVersionResponse } from './types/workflow-version-response.type';

@Injectable()
export class WorkflowMapper {
  toWorkflowResponse(
    workflow: Workflow & { currentVersion?: WorkflowVersion | null },
  ): WorkflowResponse {
    return {
      id: workflow.id,
      workspaceId: workflow.workspaceId,
      creatorId: workflow.creatorId,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      draftDefinition: this.toObjectOrNull(workflow.draftDefinition),
      currentVersionId: workflow.currentVersionId,
      currentVersion: workflow.currentVersion?.version ?? null,
      createdAt: formatShanghaiDateTime(workflow.createdAt),
      updatedAt: formatShanghaiDateTime(workflow.updatedAt),
    };
  }

  toWorkflowVersionResponse(
    workflowVersion: WorkflowVersion,
  ): WorkflowVersionResponse {
    return {
      id: workflowVersion.id,
      workflowId: workflowVersion.workflowId,
      createdBy: workflowVersion.createdBy,
      version: workflowVersion.version,
      definition: this.toObjectOrEmpty(workflowVersion.definition),
      inputSchema: this.toObjectOrNull(workflowVersion.inputSchema),
      outputSchema: this.toObjectOrNull(workflowVersion.outputSchema),
      isPublished: workflowVersion.isPublished,
      publishedAt: workflowVersion.publishedAt
        ? formatShanghaiDateTime(workflowVersion.publishedAt)
        : null,
      createdAt: formatShanghaiDateTime(workflowVersion.createdAt),
      updatedAt: formatShanghaiDateTime(workflowVersion.updatedAt),
    };
  }

  toWorkflowRunNodeResponse(node: WorkflowRunNode): WorkflowRunNodeResponse {
    return {
      id: node.id,
      runId: node.runId,
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      status: node.status,
      input: this.toObjectOrNull(node.input),
      output: this.toObjectOrNull(node.output),
      errorMessage: node.errorMessage,
      durationMs: node.durationMs,
      startedAt: node.startedAt ? formatShanghaiDateTime(node.startedAt) : null,
      endedAt: node.endedAt ? formatShanghaiDateTime(node.endedAt) : null,
      createdAt: formatShanghaiDateTime(node.createdAt),
      updatedAt: formatShanghaiDateTime(node.updatedAt),
    };
  }

  toWorkflowRunResponse(
    run:
      | WorkflowRun
      | (WorkflowRun & {
          nodes?: WorkflowRunNode[];
        }),
    includeNodes: boolean,
  ): WorkflowRunResponse {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workflowVersionId: run.workflowVersionId,
      workspaceId: run.workspaceId,
      startedBy: run.startedBy,
      status: run.status,
      input: this.toObjectOrNull(run.input),
      output: this.toObjectOrNull(run.output),
      errorMessage: run.errorMessage,
      startedAt: formatShanghaiDateTime(run.startedAt),
      endedAt: run.endedAt ? formatShanghaiDateTime(run.endedAt) : null,
      createdAt: formatShanghaiDateTime(run.createdAt),
      updatedAt: formatShanghaiDateTime(run.updatedAt),
      nodes:
        includeNodes && 'nodes' in run && Array.isArray(run.nodes)
          ? run.nodes.map((node) => this.toWorkflowRunNodeResponse(node))
          : undefined,
    };
  }

  toObjectOrNull(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  toObjectOrEmpty(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }
}

