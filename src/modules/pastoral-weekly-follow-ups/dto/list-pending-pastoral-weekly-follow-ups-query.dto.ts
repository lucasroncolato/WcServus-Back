import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class ListPendingPastoralWeeklyFollowUpsQueryDto {
  @ApiPropertyOptional({ description: 'Inicio da semana no formato YYYY-MM-DD', example: '2026-03-23' })
  @IsOptional()
  @IsDateString()
  weekStartDate?: string;
}
