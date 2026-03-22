import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ResolvePastoralVisitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}