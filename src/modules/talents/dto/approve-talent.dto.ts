import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveTalentDto {
  @ApiPropertyOptional({ example: 'Aprovado para atuar no próximo ciclo de escalas.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
