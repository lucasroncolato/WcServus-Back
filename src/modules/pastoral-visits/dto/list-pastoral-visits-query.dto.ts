import { ApiPropertyOptional } from '@nestjs/swagger';
import { PastoralPriority, PastoralReasonType, PastoralVisitStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListPastoralVisitsQueryDto {
  @ApiPropertyOptional({ enum: PastoralVisitStatus })
  @IsOptional()
  @IsEnum(PastoralVisitStatus)
  status?: PastoralVisitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servantId?: string;

  @ApiPropertyOptional({ enum: PastoralPriority })
  @IsOptional()
  @IsEnum(PastoralPriority)
  priority?: PastoralPriority;

  @ApiPropertyOptional({ enum: PastoralReasonType })
  @IsOptional()
  @IsEnum(PastoralReasonType)
  reasonType?: PastoralReasonType;
}
