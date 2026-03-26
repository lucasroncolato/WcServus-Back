import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ListPastoralWeeklyFollowUpsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sectorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibleUserId?: string;

  @ApiPropertyOptional({ example: '2026-03-23' })
  @IsOptional()
  @IsDateString()
  weekStartDateFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-30' })
  @IsOptional()
  @IsDateString()
  weekStartDateTo?: string;
}
