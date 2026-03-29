import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { TimelineEntryType, TimelineScope } from '@prisma/client';

export class TimelineQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: TimelineScope })
  @IsOptional()
  @IsEnum(TimelineScope)
  scope?: TimelineScope;

  @ApiPropertyOptional({ enum: TimelineEntryType })
  @IsOptional()
  @IsEnum(TimelineEntryType)
  type?: TimelineEntryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  origin?: string;
}
