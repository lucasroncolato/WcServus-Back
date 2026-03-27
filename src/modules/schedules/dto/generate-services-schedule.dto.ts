import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ScheduleGenerationWeightsDto } from './schedule-generation-weights.dto';

export class GenerateServicesScheduleDto {
  @ApiProperty({ type: [String], example: ['clx_service_1', 'clx_service_2'] })
  @IsArray()
  @IsString({ each: true })
  serviceIds: string[];

  @ApiPropertyOptional({ type: [String], example: ['clx_sector_1', 'clx_sector_2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectorIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['clx_ministry_1', 'clx_ministry_2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ministryIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['team_1', 'team_2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamIds?: string[];

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
