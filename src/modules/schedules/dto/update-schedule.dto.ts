import { ApiPropertyOptional } from '@nestjs/swagger';
import { MinistryTaskReallocationMode, ScheduleStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class UpdateScheduleTaskManualAssignmentDto {
  @ApiProperty({ description: 'ID da ocorrencia da tarefa ministerial' })
  @IsString()
  occurrenceId: string;

  @ApiProperty({ description: 'Novo servo responsavel da ocorrencia' })
  @IsString()
  newAssignedServantId: string;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Novo servo para esta escala' })
  @IsOptional()
  @IsString()
  servantId?: string;

  @ApiPropertyOptional({ description: 'Novo ministerio para esta escala' })
  @IsOptional()
  @IsString()
  ministryId?: string;

  @ApiPropertyOptional({ description: 'ID relacional da equipe (canonico).' })
  @IsOptional()
  @IsString()
  teamId?: string;
  @ApiPropertyOptional({ enum: ScheduleStatus, description: 'Status da escala' })
  @IsOptional()
  @Transform(({ value }) => (value === 'CONFIRMADO' ? ScheduleStatus.CONFIRMED : value))
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @ApiPropertyOptional({
    enum: MinistryTaskReallocationMode,
    description:
      'Estrategia para tarefas ministeriais vinculadas ao culto quando o servo da escala for trocado',
  })
  @IsOptional()
  @IsEnum(MinistryTaskReallocationMode)
  ministryTaskReallocationMode?: MinistryTaskReallocationMode;

  @ApiPropertyOptional({
    type: [UpdateScheduleTaskManualAssignmentDto],
    description: 'Reatribuicoes manuais por ocorrencia quando modo MANUAL for usado',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateScheduleTaskManualAssignmentDto)
  ministryTaskManualAssignments?: UpdateScheduleTaskManualAssignmentDto[];

  @ApiPropertyOptional({
    description: 'Motivo operacional para a realocacao de tarefas ministeriais',
  })
  @IsOptional()
  @IsString()
  ministryTaskReallocationReason?: string;
}
