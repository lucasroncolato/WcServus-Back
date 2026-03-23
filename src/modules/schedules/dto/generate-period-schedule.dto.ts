import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ScheduleGenerationWeightsDto } from './schedule-generation-weights.dto';

export class GeneratePeriodScheduleDto {
  @ApiProperty({ example: '2026-03-23' })
  @IsString()
  startDate: string;

  @ApiProperty({ example: '2026-04-21' })
  @IsString()
  endDate: string;

  @ApiPropertyOptional({ type: [Number], description: '0=Dom ... 6=Sab' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @ApiPropertyOptional({ type: [String], example: ['clx_sector_1', 'clx_sector_2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectorIds?: string[];

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  classGroup?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  respectFairnessRules?: boolean;

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

