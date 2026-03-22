import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GenerateYearScheduleDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2020)
  year: number;

  @ApiPropertyOptional({ type: [String], example: ['clx_sector_1', 'clx_sector_2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectorIds?: string[];

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  classGroup?: string;
}
