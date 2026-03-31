import { ApiPropertyOptional } from '@nestjs/swagger';
import { PastoralVisitStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ResolvePastoralVisitDto {
  @ApiPropertyOptional({ enum: PastoralVisitStatus, default: PastoralVisitStatus.RESOLVIDA })
  @IsOptional()
  @IsEnum(PastoralVisitStatus)
  status?: PastoralVisitStatus;

  @ApiPropertyOptional({ example: 'Visita concluida. Servo orientado e acompanhado.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
