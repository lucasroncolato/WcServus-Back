import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorshipServiceStatus, WorshipServiceType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateWorshipServiceDto {
  @ApiPropertyOptional({ enum: WorshipServiceType })
  @IsOptional()
  @IsEnum(WorshipServiceType)
  type?: WorshipServiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  serviceDate?: string;

  @ApiPropertyOptional({ example: '19:30' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: WorshipServiceStatus })
  @IsOptional()
  @IsEnum(WorshipServiceStatus)
  status?: WorshipServiceStatus;
}