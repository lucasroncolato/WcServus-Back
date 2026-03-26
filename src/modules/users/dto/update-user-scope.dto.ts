import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserScope } from '@prisma/client';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateUserScopeDto {
  @ApiProperty({ enum: UserScope })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsEnum(UserScope)
  scopeType: UserScope;

  @ApiPropertyOptional({
    type: [String],
    description: 'Vínculos de escopo por setor (IDs de Sector).',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  sectorIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Vínculos de escopo por equipe (IDs de Team).',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  teamIds?: string[];

}
