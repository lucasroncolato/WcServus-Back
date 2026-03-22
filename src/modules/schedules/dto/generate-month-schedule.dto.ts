import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateMonthScheduleDto {
  @ApiProperty()
  @IsInt()
  @Min(2020)
  year: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  sectorIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classGroup?: string;
}