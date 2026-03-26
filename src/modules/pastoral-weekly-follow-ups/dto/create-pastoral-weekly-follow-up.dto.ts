import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreatePastoralWeeklyFollowUpDto {
  @ApiProperty({ example: 'clx_servant_1' })
  @IsString()
  servantId: string;

  @ApiProperty({ description: 'Inicio da semana no formato YYYY-MM-DD', example: '2026-03-23' })
  @IsDateString()
  weekStartDate: string;

  @ApiPropertyOptional({ example: 'clx_schedule_1' })
  @IsOptional()
  @IsString()
  scheduleId?: string;

  @ApiPropertyOptional({ description: 'Data/hora efetiva do contato pastoral.' })
  @IsOptional()
  @IsDateString()
  contactedAt?: string;

  @ApiPropertyOptional({ description: 'Observacao pastoral opcional.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
