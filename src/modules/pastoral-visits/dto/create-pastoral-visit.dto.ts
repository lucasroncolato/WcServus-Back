import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PastoralPriority, PastoralReasonType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePastoralVisitDto {
  @ApiProperty({ example: 'clx_servant_1' })
  @IsString()
  servantId: string;

  @ApiProperty({ example: 'Duas faltas consecutivas sem justificativa.' })
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiPropertyOptional({ example: 'Acompanhamento de constancia ministerial' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: PastoralPriority })
  @IsOptional()
  @IsEnum(PastoralPriority)
  priority?: PastoralPriority;

  @ApiPropertyOptional({ enum: PastoralReasonType })
  @IsOptional()
  @IsEnum(PastoralReasonType)
  reasonType?: PastoralReasonType;

  @ApiPropertyOptional({ example: 'clx_user_1' })
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiPropertyOptional({ example: '2026-04-05T18:00:00.000Z' })
  @IsOptional()
  @IsString()
  nextFollowUpAt?: string;

  @ApiPropertyOptional({ example: 'Agendar conversa com lider antes da visita.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
