import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Novo servo para esta escala' })
  @IsOptional()
  @IsString()
  servantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classGroup?: string;
}