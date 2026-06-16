import { PartialType } from '@nestjs/swagger';
import { CreateWorkspaceModelDto } from './create-workspace-model.dto';

// 更新模型时字段全部可选；是否可删除和默认模型关系由 Service 层处理。
export class UpdateWorkspaceModelDto extends PartialType(
  CreateWorkspaceModelDto,
) {}
