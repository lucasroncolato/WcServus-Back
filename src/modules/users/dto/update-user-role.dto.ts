import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { normalizeRoleAlias } from './role-aliases';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role })
  @Transform(({ value }) => normalizeRoleAlias(value))
  @IsEnum(Role)
  role: Role;
}
