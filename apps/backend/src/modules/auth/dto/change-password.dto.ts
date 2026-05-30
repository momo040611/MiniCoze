import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldPassword123' })
  @IsString()
  @MinLength(6)
  oldPassword!: string;

  @ApiProperty({ example: 'newPassword456' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
