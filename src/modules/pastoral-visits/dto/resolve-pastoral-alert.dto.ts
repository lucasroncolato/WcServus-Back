import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResolvePastoralAlertDto {
  @ApiPropertyOptional({ example: 'Acompanhamento iniciado e alerta tratado pela lideranca.' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}