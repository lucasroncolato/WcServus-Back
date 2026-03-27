import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteTrainingDto {
  @ApiPropertyOptional({ description: 'Ministerio alvo para concluir treinamento especifico.' })
  @IsOptional()
  @IsString()
  ministryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
