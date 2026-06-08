import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class UpdateMemberDto {
  @ApiProperty({
    description: '新角色',
    enum: WorkspaceRole,
  })
  @IsEnum(WorkspaceRole, { message: '角色必须是 OWNER、ADMIN 或 MEMBER' })
  role!: WorkspaceRole;
}
