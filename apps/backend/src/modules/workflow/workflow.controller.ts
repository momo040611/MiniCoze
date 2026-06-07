import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUserInfo } from '../../common/decorators/current-user.decorator';
import { SkipResponseWrap } from '../../common/decorators/skip-response-wrap.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser } from '../../shared/types/current-user.type';
import type { WorkflowStreamEvent } from './internal/execute/workflow-run-event';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { PublishWorkflowDto } from './dto/publish-workflow.dto';
import { RunWorkflowDto } from './dto/run-workflow.dto';
import { SaveWorkflowDraftDto } from './dto/save-workflow-draft.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowQueryDto } from './dto/workflow-query.dto';
import { WorkflowRunQueryDto } from './dto/workflow-run-query.dto';
import { WorkflowRunService } from './workflow-run.service';
import { WorkflowService } from './workflow.service';

@ApiTags('workflow')
@Controller('workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowRunService: WorkflowRunService,
  ) {}

  // 参数：
  // - body.workspaceId: 工作空间 ID（必填）
  // - body.name: 工作流名称（必填）
  // - body.description: 描述（可选）
  // - body.definition: 初始画布定义（可选）
  // 作用：创建工作流主记录与初始草稿定义。
  @Post()
  @ApiOperation({ summary: '创建工作流' })
  create(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflowService.create(currentUser.id, dto);
  }

  // 参数：
  // - query.workspaceId: 工作空间 ID（必填）
  // - query.page/query.pageSize: 分页参数
  // - query.status: 工作流状态筛选（可选）
  // - query.keyword: 名称/描述关键词（可选）
  // 作用：查询某工作空间下的工作流列表。
  @Get()
  @ApiOperation({ summary: '获取工作流列表' })
  findByWorkspace(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Query() query: WorkflowQueryDto,
  ) {
    return this.workflowService.findByWorkspace(currentUser.id, query);
  }

  // 参数：
  // - path.runId: 运行实例 ID
  // 作用：查询单次运行详情（包含节点执行记录）。
  @Get('runs/:runId')
  @ApiOperation({ summary: '获取工作流运行详情' })
  findRun(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('runId') runId: string,
  ) {
    return this.workflowRunService.findRunForUser(currentUser.id, runId);
  }

  // 参数：
  // - path.workflowId: 工作流 ID
  // 作用：查询工作流详情（草稿、当前版本等）。
  @Get(':workflowId')
  @ApiOperation({ summary: '获取工作流详情' })
  findOne(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.workflowService.findOneForUser(currentUser.id, workflowId);
  }

  // 参数：
  // - path.workflowId: 工作流 ID
  // - body.name/body.description: 基础信息更新字段（均可选）
  // 作用：更新工作流基础元信息，不改草稿定义。
  @Patch(':workflowId')
  @ApiOperation({ summary: '更新工作流基础信息' })
  update(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowService.update(currentUser.id, workflowId, dto);
  }

  // 参数：
  // - path.workflowId: 工作流 ID
  // - body.definition: 画布定义（必填）
  // 作用：保存当前草稿定义，供后续校验/发布/运行。
  @Put(':workflowId/draft')
  @ApiOperation({ summary: '保存工作流草稿定义' })
  saveDraft(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: SaveWorkflowDraftDto,
  ) {
    return this.workflowService.saveDraft(currentUser.id, workflowId, dto);
  }

  // 参数：
  // - path.workflowId: 工作流 ID
  // 作用：校验当前草稿图结构与节点配置是否合法。
  @Post(':workflowId/validate')
  @ApiOperation({ summary: '校验工作流草稿' })
  validateDraft(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.workflowService.validateDraft(currentUser.id, workflowId);
  }

  // 参数：
  // - path.workflowId: 工作流 ID
  // - body.inputSchema/body.outputSchema: 输入输出 schema（可选）
  // 作用：把当前草稿发布为新版本并更新当前生效版本。
  @Post(':workflowId/publish')
  @ApiOperation({ summary: '发布工作流版本' })
  publish(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: PublishWorkflowDto,
  ) {
    return this.workflowService.publish(currentUser.id, workflowId, dto);
  }

  // 参数：
  // - path.workflowId: 工作流 ID
  // 作用：查询该工作流的版本历史列表。
  @Get(':workflowId/versions')
  @ApiOperation({ summary: '获取工作流版本列表' })
  listVersions(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
  ) {
    return this.workflowService.listVersions(currentUser.id, workflowId);
  }

  // 参数：
  // - path.workflowId: 工作流 ID
  // - body.input: 运行输入（可选）
  // - body.version: 指定运行版本（可选，不传默认当前版本）
  // 作用：触发一次工作流运行并返回本次运行结果。
  @Post(':workflowId/run')
  @ApiOperation({ summary: '触发工作流运行（基础版）' })
  run(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: RunWorkflowDto,
  ) {
    return this.workflowRunService.run(currentUser.id, workflowId, dto);
  }

  // 参数：
  // - path.workflowId: 工作流 ID
  // - body.input/body.version: 同 run
  // 作用：以 SSE 流式运行工作流，实时推送运行级/节点级事件。
  // 事件类型：run.created / node.started / node.completed / node.failed
  //          / run.completed / run.failed / stream.done
  @Post(':workflowId/run/stream')
  @SkipResponseWrap()
  @ApiOperation({ summary: '流式运行工作流（SSE 实时事件）' })
  async runStream(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Body() dto: RunWorkflowDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (event: WorkflowStreamEvent): void => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      await this.workflowRunService.run(currentUser.id, workflowId, dto, send);
    } catch (error) {
      // 运行前的错误（权限/校验/版本）会抛到这里，run 内部错误已通过 run.failed 推送。
      const message = error instanceof Error ? error.message : String(error);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message })}\n\n`);
    } finally {
      res.end();
    }
  }

  // 参数：
  // - path.runId: 运行实例 ID
  // 作用：请求取消一次正在运行的工作流（运行中的会在下个节点前中断）。
  @Post('runs/:runId/cancel')
  @ApiOperation({ summary: '取消工作流运行' })
  cancelRun(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('runId') runId: string,
  ) {
    return this.workflowRunService.requestCancel(currentUser.id, runId);
  }

  // 参数：
  // - path.workflowId: 工作流 ID
  // - query.page/query.pageSize: 分页参数
  // - query.status: 运行状态筛选（可选）
  // 作用：查询该工作流的运行历史。
  @Get(':workflowId/runs')
  @ApiOperation({ summary: '获取工作流运行列表' })
  listRuns(
    @CurrentUserInfo() currentUser: CurrentUser,
    @Param('workflowId') workflowId: string,
    @Query() query: WorkflowRunQueryDto,
  ) {
    return this.workflowRunService.listRuns(currentUser.id, workflowId, query);
  }
}
