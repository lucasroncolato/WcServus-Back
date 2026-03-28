import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ListScheduleWorkspaceQueryDto {
  @ApiPropertyOptional({ description: 'Data inicial no formato YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data final no formato YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Ministerio do contexto operacional.' })
  @IsOptional()
  @IsString()
  ministryId?: string;
}

