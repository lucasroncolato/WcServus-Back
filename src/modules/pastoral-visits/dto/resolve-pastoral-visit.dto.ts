import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResolvePastoralVisitDto {
  @ApiPropertyOptional({ example: 'Visita concluída. Servo orientado e acompanhado.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
