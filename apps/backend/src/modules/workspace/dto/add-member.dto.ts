import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty({ description: '成员邮箱', example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @ApiProperty({
    description: '成员角色',
    enum: WorkspaceRole,
    default: WorkspaceRole.MEMBER,
    required: false,
  })
  @IsEnum(WorkspaceRole, { message: '角色必须是 OWNER、ADMIN 或 MEMBER' })
  @IsOptional()
  role?: WorkspaceRole;
}
