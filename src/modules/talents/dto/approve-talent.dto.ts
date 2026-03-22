import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveTalentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}