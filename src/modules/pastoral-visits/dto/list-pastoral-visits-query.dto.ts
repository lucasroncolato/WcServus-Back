import { ApiPropertyOptional } from '@nestjs/swagger';
import { PastoralVisitStatus } from '@prisma/client';
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
}