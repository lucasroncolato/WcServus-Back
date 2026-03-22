import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateMonthScheduleDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2020)
  year: number;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

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
