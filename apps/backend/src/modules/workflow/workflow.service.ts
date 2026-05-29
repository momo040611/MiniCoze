import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  Workflow,
  WorkflowStatus,
  WorkflowVersion,
  WorkflowVersionStatus,
} from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { PublishWorkflowDto } from './dto/publish-workflow.dto';
import { SaveWorkflowGraphDto } from './dto/save-workflow-graph.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowQueryDto } from './dto/workflow-query.dto';
import {
  WorkflowResponse,
  WorkflowVersionResponse,
} from './types/workflow-response.type';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async create(
    userId: string,
    createWorkflowDto: CreateWorkflowDto,
  ): Promise<WorkflowResponse> {
    await this.workspaceAccessService.ensureCanManage(
      userId,
      createWorkflowDto.workspaceId,
    );

    const graph = createWorkflowDto.graph ?? this.createEmptyGraph();
    this.validateGraphShape(graph);

    const workflow = await this.prisma.workflow.create({
      data: {
        workspaceId: createWorkflowDto.workspaceId,
        creatorId: userId,
        name: createWorkflowDto.name,
        description: createWorkflowDto.description,
        graph: this.toInputJsonValue(graph),
      },
    });

    return this.toWorkflowResponse(workflow);
  }

  async findByWorkspace(userId: string, query: WorkflowQueryDto) {
    await this.workspaceAccessService.ensureMember(userId, query.workspaceId);

    const { page, pageSize, workspaceId, status, keyword } = query;
    const where: Prisma.WorkflowWhereInput = {
      workspaceId,
      status,
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [workflows, total] = await this.prisma.$transaction([
      this.prisma.workflow.findMany({
        where,
        orderBy: {
          updatedAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workflow.count({ where }),
    ]);

    return createPaginatedData({
      list: workflows.map((workflow) => this.toWorkflowResponse(workflow)),
      total,
      page,
      pageSize,
    });
  }

  async findOneForUser(
    userId: string,
    workflowId: string,
  ): Promise<WorkflowResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureMember(
      userId,
      workflow.workspaceId,
    );

    return this.toWorkflowResponse(workflow);
  }

  async update(
    userId: string,
    workflowId: string,
    updateWorkflowDto: UpdateWorkflowDto,
  ): Promise<WorkflowResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );

    const updatedWorkflow = await this.prisma.workflow.update({
      where: {
        id: workflowId,
      },
      data: {
        name: updateWorkflowDto.name,
        description: updateWorkflowDto.description,
        status: updateWorkflowDto.status,
      },
    });

    return this.toWorkflowResponse(updatedWorkflow);
  }

  async saveGraph(
    userId: string,
    workflowId: string,
    saveWorkflowGraphDto: SaveWorkflowGraphDto,
  ): Promise<WorkflowResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );

    this.validateGraphShape(saveWorkflowGraphDto.graph);

    const updatedWorkflow = await this.prisma.workflow.update({
      where: {
        id: workflowId,
      },
      data: {
        graph: this.toInputJsonValue(saveWorkflowGraphDto.graph),
      },
    });

    return this.toWorkflowResponse(updatedWorkflow);
  }

  async publish(
    userId: string,
    workflowId: string,
    publishWorkflowDto: PublishWorkflowDto,
  ): Promise<WorkflowVersionResponse> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      workflow.workspaceId,
    );
    this.validatePublishableGraph(workflow.graph);

    const version = await this.prisma.$transaction(async (tx) => {
      const latestVersion = await tx.workflowVersion.findFirst({
        where: {
          workflowId,
        },
        orderBy: {
          version: 'desc',
        },
        select: {
          version: true,
        },
      });

      const createdVersion = await tx.workflowVersion.create({
        data: {
          workflowId,
          version: (latestVersion?.version ?? 0) + 1,
          snapshot: this.toInputJsonValue(workflow.graph),
          description: publishWorkflowDto.description,
          createdBy: userId,
        },
      });

      await tx.workflow.update({
        where: {
          id: workflowId,
        },
        data: {
          status: WorkflowStatus.ACTIVE,
          publishedVersionId: createdVersion.id,
        },
      });

      return createdVersion;
    });

    return this.toWorkflowVersionResponse(version);
  }

  async findVersions(
    userId: string,
    workflowId: string,
  ): Promise<WorkflowVersionResponse[]> {
    const workflow = await this.findWorkflowOrThrow(workflowId);
    await this.workspaceAccessService.ensureMember(
      userId,
      workflow.workspaceId,
    );

    const versions = await this.prisma.workflowVersion.findMany({
      where: {
        workflowId,
      },
      orderBy: {
        version: 'desc',
      },
    });

    return versions.map((version) => this.toWorkflowVersionResponse(version));
  }

  private createEmptyGraph(): Prisma.InputJsonObject {
    return {
      version: 1,
      nodes: [],
      edges: [],
      variables: [],
    };
  }

  private toInputJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private async findWorkflowOrThrow(workflowId: string): Promise<Workflow> {
    const workflow = await this.prisma.workflow.findUnique({
      where: {
        id: workflowId,
      },
    });

    if (!workflow) {
      throw new BusinessException(
        '工作流不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return workflow;
  }

  private validateGraphShape(graph: unknown): asserts graph is {
    nodes: unknown[];
    edges: unknown[];
    variables: unknown[];
  } {
    if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
      this.throwInvalidGraph('工作流 DSL 必须是对象');
    }

    const graphRecord = graph as Record<string, unknown>;
    if (!Array.isArray(graphRecord.nodes)) {
      this.throwInvalidGraph('工作流 DSL 缺少 nodes 数组');
    }

    if (!Array.isArray(graphRecord.edges)) {
      this.throwInvalidGraph('工作流 DSL 缺少 edges 数组');
    }

    if (!Array.isArray(graphRecord.variables)) {
      this.throwInvalidGraph('工作流 DSL 缺少 variables 数组');
    }
  }

  private validatePublishableGraph(graph: unknown) {
    this.validateGraphShape(graph);

    const hasStartNode = graph.nodes.some((node) =>
      this.isNodeType(node, 'start'),
    );
    const hasEndNode = graph.nodes.some((node) => this.isNodeType(node, 'end'));

    if (!hasStartNode) {
      this.throwInvalidGraph('工作流发布前必须包含 start 节点');
    }

    if (!hasEndNode) {
      this.throwInvalidGraph('工作流发布前必须包含 end 节点');
    }
  }

  private isNodeType(node: unknown, type: string): boolean {
    return (
      !!node &&
      typeof node === 'object' &&
      !Array.isArray(node) &&
      (node as Record<string, unknown>).type === type
    );
  }

  private throwInvalidGraph(message: string): never {
    throw new BusinessException(
      message,
      ErrorCode.BadRequest,
      HttpStatus.BAD_REQUEST,
    );
  }

  private toWorkflowResponse(workflow: Workflow): WorkflowResponse {
    return {
      id: workflow.id,
      workspaceId: workflow.workspaceId,
      creatorId: workflow.creatorId,
      name: workflow.name,
      description: workflow.description,
      graph: workflow.graph,
      status: workflow.status,
      publishedVersionId: workflow.publishedVersionId,
      createdAt: formatShanghaiDateTime(workflow.createdAt),
      updatedAt: formatShanghaiDateTime(workflow.updatedAt),
    };
  }

  private toWorkflowVersionResponse(
    version: WorkflowVersion,
  ): WorkflowVersionResponse {
    return {
      id: version.id,
      workflowId: version.workflowId,
      version: version.version,
      snapshot: version.snapshot,
      description: version.description,
      status: version.status ?? WorkflowVersionStatus.ACTIVE,
      createdBy: version.createdBy,
      createdAt: formatShanghaiDateTime(version.createdAt),
    };
  }
}
