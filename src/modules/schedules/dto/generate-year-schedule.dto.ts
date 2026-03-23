import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { ScheduleGenerationWeightsDto } from './schedule-generation-weights.dto';

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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowMultiSectorSameService?: boolean;

  @ApiPropertyOptional({ type: ScheduleGenerationWeightsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ScheduleGenerationWeightsDto)
  weights?: ScheduleGenerationWeightsDto;
}
