import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MinistryTaskOccurrenceCriticality,
  MinistryTaskOccurrencePriority,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateMinistryTaskOccurrenceDto {
  @ApiProperty()
  @IsString()
  templateId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiProperty()
  @IsDateString()
  scheduledFor: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  slaMinutes?: number;

  @ApiPropertyOptional({ enum: MinistryTaskOccurrencePriority, default: MinistryTaskOccurrencePriority.MEDIUM })
  @IsOptional()
  @IsEnum(MinistryTaskOccurrencePriority)
  priority?: MinistryTaskOccurrencePriority;

  @ApiPropertyOptional({
    enum: MinistryTaskOccurrenceCriticality,
    default: MinistryTaskOccurrenceCriticality.MEDIUM,
  })
  @IsOptional()
  @IsEnum(MinistryTaskOccurrenceCriticality)
  criticality?: MinistryTaskOccurrenceCriticality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedServantId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportServantIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1500)
  notes?: string;
}
