import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserScope, UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateServantAccessDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6, maxLength: 72 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({ enum: Role, default: Role.SERVO })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: UserScope, default: UserScope.SELF })
  @IsOptional()
  @IsEnum(UserScope)
  scope?: UserScope;

  @ApiPropertyOptional({ description: 'Sobrescreve nome inicial do usuario' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
