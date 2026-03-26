import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MonthlyFastingStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class RegisterMonthlyFastingDto {
  @ApiPropertyOptional({
    description:
      'Obrigatorio para perfis administrativos. Para COORDENADOR/SERVO o backend usa sempre o proprio cadastro pessoal.',
  })
  @IsOptional()
  @IsString()
  servantId?: string;

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
