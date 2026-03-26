import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MonthlyFastingStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class RegisterMonthlyFastingDto {
  @ApiProperty()
  @IsString()
  servantId: string;

  @ApiProperty({ description: 'Mes de referencia no formato YYYY-MM.', example: '2026-03' })
  @Matches(/^\d{4}-\d{2}$/)
  referenceMonth: string;

  @ApiPropertyOptional({ enum: MonthlyFastingStatus, default: MonthlyFastingStatus.COMPLETED })
  @IsOptional()
  @IsEnum(MonthlyFastingStatus)
  status?: MonthlyFastingStatus;

  @ApiPropertyOptional({ description: 'Data/hora em que o jejum foi concluido.' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
