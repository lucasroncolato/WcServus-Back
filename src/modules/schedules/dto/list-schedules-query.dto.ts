import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { WindowMode } from 'src/common/utils/planning-window.utils';

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

  @ApiPropertyOptional({
    enum: ['day', 'week', 'month', 'rolling30', 'rolling60', 'rolling90'],
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'rolling30', 'rolling60', 'rolling90'])
  windowMode?: WindowMode;

  @ApiPropertyOptional({ description: 'Data base no formato yyyy-mm-dd' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data final no formato yyyy-mm-dd (opcional)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ type: [Number], description: '0=Dom ... 6=Sab' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map((item) => Number(item));
    }
    return String(value)
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => !Number.isNaN(item));
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];
}
