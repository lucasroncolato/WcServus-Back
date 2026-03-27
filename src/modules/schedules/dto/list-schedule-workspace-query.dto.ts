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

  @ApiPropertyOptional({ description: 'Compatibilidade legado.' })
  @IsOptional()
  @IsString()
  sectorId?: string;

  @ApiPropertyOptional({ description: 'Nomenclatura oficial do dominio.' })
  @IsOptional()
  @IsString()
  ministryId?: string;
}

