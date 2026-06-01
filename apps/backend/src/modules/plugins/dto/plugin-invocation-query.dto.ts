import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class PluginInvocationQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: 'workspace-id' })
  @IsString()
  workspaceId!: string;
}
