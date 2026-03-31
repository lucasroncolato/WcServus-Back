import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertStatus, PastoralAlertSeverity, PastoralAlertSource } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListPastoralAlertsQueryDto {
  @ApiPropertyOptional({ enum: AlertStatus })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({ enum: PastoralAlertSeverity })
  @IsOptional()
  @IsEnum(PastoralAlertSeverity)
  severity?: PastoralAlertSeverity;

  @ApiPropertyOptional({ enum: PastoralAlertSource })
  @IsOptional()
  @IsEnum(PastoralAlertSource)
  source?: PastoralAlertSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servantId?: string;
}