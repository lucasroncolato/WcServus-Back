import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { IsEnum } from 'class-validator';

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
}
