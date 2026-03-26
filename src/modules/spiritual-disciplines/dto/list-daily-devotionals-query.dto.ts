import { ApiPropertyOptional } from '@nestjs/swagger';
import { DevotionalStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListDailyDevotionalsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servantId?: string;

  @ApiPropertyOptional({ enum: DevotionalStatus })
  @IsOptional()
  @IsEnum(DevotionalStatus)
  status?: DevotionalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibleUserId?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
