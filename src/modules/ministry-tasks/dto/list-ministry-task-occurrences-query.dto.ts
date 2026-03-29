import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  MinistryTaskOccurrenceCriticality,
  MinistryTaskOccurrencePriority,
  MinistryTaskOccurrenceStatus,
  MinistryTaskReallocationStatus,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListMinistryTaskOccurrencesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ministryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedServantId?: string;

  @ApiPropertyOptional({ description: 'Filtra ocorrencias sem responsavel principal' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({ description: 'Filtra ocorrencias em atraso (dueAt < now e nao concluida/cancelada)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Filtra ocorrencias vencendo nas proximas 24 horas' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  dueSoon?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ enum: MinistryTaskOccurrenceStatus })
  @IsOptional()
  @IsEnum(MinistryTaskOccurrenceStatus)
  status?: MinistryTaskOccurrenceStatus;

  @ApiPropertyOptional({ enum: MinistryTaskReallocationStatus })
  @IsOptional()
  @IsEnum(MinistryTaskReallocationStatus)
  reallocationStatus?: MinistryTaskReallocationStatus;

  @ApiPropertyOptional({ enum: MinistryTaskOccurrencePriority })
  @IsOptional()
  @IsEnum(MinistryTaskOccurrencePriority)
  priority?: MinistryTaskOccurrencePriority;

  @ApiPropertyOptional({ enum: MinistryTaskOccurrenceCriticality })
  @IsOptional()
  @IsEnum(MinistryTaskOccurrenceCriticality)
  criticality?: MinistryTaskOccurrenceCriticality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
