import { HttpStatus, Injectable } from '@nestjs/common';
import { type Agent, type Prisma } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { ReplaceAgentWorkflowBindingsDto } from './dto/replace-agent-workflow-bindings.dto';
import { UpdateAgentWorkflowBindingDto } from './dto/update-agent-workflow-binding.dto';
import { AgentWorkflowBindingResponse } from './types/agent-workflow-binding-response.type';

type WorkflowBindingWithWorkflow = Prisma.AgentWorkflowGetPayload<{
  include: {
    workflow: true;
    workflowVersion: true;
  };
}>;

type WorkflowBindingWithAgent = Prisma.AgentWorkflowGetPayload<{
  include: {
    workflow: true;
    workflowVersion: true;
    agent: true;
  };
}>;

@Injectable()
export class AgentWorkflowBindingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async listForAgent(
    userId: string,
    agentId: string,
  ): Promise<AgentWorkflowBindingResponse[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);

    const bindings = await this.prisma.agentWorkflow.findMany({
      where: { agentId },
      include: {
        workflow: true,
        workflowVersion: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return bindings.map((binding) => this.toBindingResponse(binding));
  }

  async replaceForAgent(
    userId: string,
    agentId: string,
    dto: ReplaceAgentWorkflowBindingsDto,
  ): Promise<AgentWorkflowBindingResponse[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    const resolvedBindings = await this.resolveBindings(
      agent.workspaceId,
      dto.bindings,
    );

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.agentWorkflow.deleteMany({
        where: { agentId },
      });

      if (!resolvedBindings.length) {
        return;
      }

      await tx.agentWorkflow.createMany({
        data: resolvedBindings.map((binding) => ({
          agentId,
          workflowId: binding.workflowId,
          workflowVersionId: binding.workflowVersionId,
          enabled: binding.enabled,
        })),
      });
    });

    return this.listForAgent(userId, agentId);
  }

  async updateBinding(
    userId: string,
    agentId: string,
    bindingId: string,
    dto: UpdateAgentWorkflowBindingDto,
  ): Promise<AgentWorkflowBindingResponse> {
    const binding = await this.findBindingOrThrow(agentId, bindingId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      binding.agent.workspaceId,
    );

    let nextWorkflowVersionId = binding.workflowVersionId;
    if (
      dto.workflowVersionId &&
      dto.workflowVersionId !== binding.workflowVersionId
    ) {
      const workflowVersion = await this.resolveWorkflowVersionOrThrow(
        binding.agent.workspaceId,
        binding.workflowId,
        dto.workflowVersionId,
      );
      nextWorkflowVersionId = workflowVersion.id;
    }

    const updated = await this.prisma.agentWorkflow.update({
      where: { id: bindingId },
      include: {
        workflow: true,
        workflowVersion: true,
      },
      data: {
        workflowVersionId: nextWorkflowVersionId,
        enabled: dto.enabled,
      },
    });

    return this.toBindingResponse(updated);
  }

  private async resolveBindings(
    workspaceId: string,
    bindings: ReplaceAgentWorkflowBindingsDto['bindings'],
  ): Promise<
    Array<{ workflowId: string; workflowVersionId: string; enabled: boolean }>
  > {
    const workflowIds = Array.from(
      new Set(bindings.map((binding) => binding.workflowId)),
    );

    if (!workflowIds.length) {
      return [];
    }

    const workflows = await this.prisma.workflow.findMany({
      where: {
        id: { in: workflowIds },
        workspaceId,
      },
      include: {
        currentVersion: true,
      },
    });

    if (workflows.length !== workflowIds.length) {
      throw new BusinessException(
        '存在不属于当前工作空间的工作流',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const workflowMap = new Map(
      workflows.map((workflow) => [workflow.id, workflow] as const),
    );

    const workflowVersionIds = Array.from(
      new Set(
        bindings
          .map((binding) => binding.workflowVersionId)
          .filter((workflowVersionId): workflowVersionId is string =>
            Boolean(workflowVersionId),
          ),
      ),
    );

    const workflowVersions = workflowVersionIds.length
      ? await this.prisma.workflowVersion.findMany({
          where: {
            id: { in: workflowVersionIds },
            isPublished: true,
          },
        })
      : [];
    const workflowVersionMap = new Map(
      workflowVersions.map((workflowVersion) => [
        workflowVersion.id,
        workflowVersion,
      ]),
    );

    return bindings.map((binding) => {
      const workflow = workflowMap.get(binding.workflowId);
      if (!workflow) {
        throw new BusinessException(
          '工作流不存在',
          ErrorCode.NotFound,
          HttpStatus.NOT_FOUND,
        );
      }

      const workflowVersionId =
        binding.workflowVersionId ?? workflow.currentVersionId;
      if (!workflowVersionId) {
        throw new BusinessException(
          `工作流尚未发布，无法绑定: ${workflow.name}`,
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }

      const workflowVersion =
        binding.workflowVersionId !== undefined
          ? workflowVersionMap.get(workflowVersionId)
          : workflow.currentVersion;

      if (
        !workflowVersion ||
        workflowVersion.workflowId !== workflow.id ||
        !workflowVersion.isPublished
      ) {
        throw new BusinessException(
          `工作流版本不可绑定: ${workflow.name}`,
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        workflowId: workflow.id,
        workflowVersionId: workflowVersion.id,
        enabled: binding.enabled ?? true,
      };
    });
  }

  private async resolveWorkflowVersionOrThrow(
    workspaceId: string,
    workflowId: string,
    workflowVersionId: string,
  ) {
    const workflowVersion = await this.prisma.workflowVersion.findFirst({
      where: {
        id: workflowVersionId,
        workflowId,
        isPublished: true,
        workflow: {
          workspaceId,
        },
      },
    });

    if (!workflowVersion) {
      throw new BusinessException(
        '工作流版本不存在或未发布',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    return workflowVersion;
  }

  private async findAgentOrThrow(agentId: string): Promise<Agent> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new BusinessException(
        'Agent 不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return agent;
  }

  private async findBindingOrThrow(
    agentId: string,
    bindingId: string,
  ): Promise<WorkflowBindingWithAgent> {
    const binding = await this.prisma.agentWorkflow.findFirst({
      where: {
        id: bindingId,
        agentId,
      },
      include: {
        workflow: true,
        workflowVersion: true,
        agent: true,
      },
    });

    if (!binding) {
      throw new BusinessException(
        'Agent 工作流绑定不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return binding;
  }

  private toBindingResponse(
    binding: WorkflowBindingWithWorkflow,
  ): AgentWorkflowBindingResponse {
    return {
      bindingId: binding.id,
      agentId: binding.agentId,
      workflowId: binding.workflowId,
      workflowVersionId: binding.workflowVersionId,
      workflowName: binding.workflow.name,
      workflowDescription: binding.workflow.description,
      workflowVersion: binding.workflowVersion.version,
      enabled: binding.enabled,
      createdAt: formatShanghaiDateTime(binding.createdAt),
      updatedAt: formatShanghaiDateTime(binding.updatedAt),
    };
  }
}
