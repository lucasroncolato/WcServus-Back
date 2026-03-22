import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GenerateYearScheduleDto {
  @ApiProperty()
  @IsInt()
  @Min(2020)
  year: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  sectorIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classGroup?: string;
}