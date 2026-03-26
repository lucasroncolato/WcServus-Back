import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MonthlyFastingStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMonthlyFastingsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servantId?: string;

  @ApiPropertyOptional({ enum: MonthlyFastingStatus })
  @IsOptional()
  @IsEnum(MonthlyFastingStatus)
  status?: MonthlyFastingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibleUserId?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
