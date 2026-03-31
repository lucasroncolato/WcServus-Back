import { ApiPropertyOptional } from '@nestjs/swagger';
import { PastoralVisitStatus, PastoralPriority, PastoralReasonType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdatePastoralVisitDto {
  @ApiPropertyOptional({ enum: PastoralVisitStatus })
  @IsOptional()
  @IsEnum(PastoralVisitStatus)
  status?: PastoralVisitStatus;

  @ApiPropertyOptional({ enum: PastoralPriority })
  @IsOptional()
  @IsEnum(PastoralPriority)
  priority?: PastoralPriority;

  @ApiPropertyOptional({ enum: PastoralReasonType })
  @IsOptional()
  @IsEnum(PastoralReasonType)
  reasonType?: PastoralReasonType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiPropertyOptional({ example: '2026-04-05T18:00:00.000Z' })
  @IsOptional()
  @IsString()
  nextFollowUpAt?: string;
}