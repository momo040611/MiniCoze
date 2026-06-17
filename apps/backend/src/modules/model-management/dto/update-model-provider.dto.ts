import { PartialType } from '@nestjs/swagger';
import { CreateModelProviderDto } from './create-model-provider.dto';

// 更新 Provider 时字段全部可选；credentialId/baseUrl 变更会在 Service 层重新校验。
export class UpdateModelProviderDto extends PartialType(
  CreateModelProviderDto,
) {}
