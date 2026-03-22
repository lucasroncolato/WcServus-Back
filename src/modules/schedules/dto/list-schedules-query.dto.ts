import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListSchedulesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sectorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servantId?: string;
}