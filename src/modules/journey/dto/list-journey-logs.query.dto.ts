import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListJourneyLogsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: ['POSITIVE', 'NEUTRAL', 'ATTENTION'] })
  @IsOptional()
  @IsIn(['POSITIVE', 'NEUTRAL', 'ATTENTION'])
  tone?: 'POSITIVE' | 'NEUTRAL' | 'ATTENTION';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}

