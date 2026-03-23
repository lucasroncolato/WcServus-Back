import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ScheduleGenerationWeightsDto {
  @ApiPropertyOptional({ example: 0.6, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  monthlyLoad?: number;

  @ApiPropertyOptional({ example: 0.2, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  recentSequence?: number;

  @ApiPropertyOptional({ example: 0.15, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  recentAbsences?: number;

  @ApiPropertyOptional({ example: 0.05, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  sectorAffinity?: number;
}
