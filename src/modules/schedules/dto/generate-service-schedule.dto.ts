import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ScheduleGenerationWeightsDto } from './schedule-generation-weights.dto';

export class GenerateServiceScheduleDto {
  @ApiProperty({ example: 'clx_service_1' })
  @IsString()
  serviceId: string;

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
