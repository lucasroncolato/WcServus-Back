import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteTrainingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}