import { Injectable } from '@nestjs/common';
import { type ToolDefinition } from '../../shared/types/agent';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { buildWorkflowToolDefinition } from './workflow-tool.util';

@Injectable()
export class WorkflowToolRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async listRunnableTools(input: {
    agentId: string;
    workspaceId: string;
    userId: string;
  }): Promise<ToolDefinition[]> {
    await this.workspaceAccessService.ensureMember(
      input.userId,
      input.workspaceId,
    );

    const bindings = await this.prisma.agentWorkflow.findMany({
      where: {
        agentId: input.agentId,
        enabled: true,
        workflow: {
          workspaceId: input.workspaceId,
        },
        workflowVersion: {
          isPublished: true,
        },
      },
      include: {
        workflow: true,
        workflowVersion: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return bindings.map((binding) =>
      buildWorkflowToolDefinition({
        workflowVersionId: binding.workflowVersionId,
        workflowName: binding.workflow.name,
        workflowDescription: binding.workflow.description,
        inputSchema: this.toObjectOrNull(binding.workflowVersion.inputSchema),
      }),
    );
  }

  private toObjectOrNull(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}
