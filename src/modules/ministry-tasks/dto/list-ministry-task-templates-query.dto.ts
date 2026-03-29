import { ApiPropertyOptional } from '@nestjs/swagger';
import { MinistryTaskRecurrenceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListMinistryTaskTemplatesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ministryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MinistryTaskRecurrenceType)
  recurrenceType?: MinistryTaskRecurrenceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  active?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  search?: string;
}
