import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MinistryTaskAssigneeMode,
  MinistryTaskReallocationMode,
  MinistryTaskRecurrenceType,
  WorshipServiceType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateMinistryTaskTemplateChecklistItemDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateMinistryTaskTemplateDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  ministryId: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1200)
  description?: string;

  @ApiPropertyOptional({ enum: MinistryTaskRecurrenceType, default: MinistryTaskRecurrenceType.MANUAL })
  @IsOptional()
  @IsEnum(MinistryTaskRecurrenceType)
  recurrenceType?: MinistryTaskRecurrenceType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  recurrenceConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: WorshipServiceType })
  @IsOptional()
  @IsEnum(WorshipServiceType)
  linkedToServiceType?: WorshipServiceType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ enum: MinistryTaskAssigneeMode, default: MinistryTaskAssigneeMode.OPTIONAL })
  @IsOptional()
  @IsEnum(MinistryTaskAssigneeMode)
  assigneeMode?: MinistryTaskAssigneeMode;

  @ApiPropertyOptional({ enum: MinistryTaskReallocationMode, default: MinistryTaskReallocationMode.MANUAL })
  @IsOptional()
  @IsEnum(MinistryTaskReallocationMode)
  reallocationMode?: MinistryTaskReallocationMode;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAssignmentsPerServantPerMonth?: number;

  @ApiPropertyOptional({ type: [CreateMinistryTaskTemplateChecklistItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateMinistryTaskTemplateChecklistItemDto)
  checklistItems?: CreateMinistryTaskTemplateChecklistItemDto[];
}
