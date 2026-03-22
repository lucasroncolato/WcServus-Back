import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreatePastoralVisitDto {
  @ApiProperty({ example: 'clx_servant_1' })
  @IsString()
  servantId: string;

  @ApiProperty({ example: 'Duas faltas consecutivas sem justificativa.' })
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiPropertyOptional({ example: 'Agendar conversa com líder antes da visita.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
