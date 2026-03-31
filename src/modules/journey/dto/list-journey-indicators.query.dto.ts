import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ListJourneyIndicatorsQueryDto {
  @ApiPropertyOptional({ enum: [30, 60, 90], default: 30 })
  @IsOptional()
  @IsIn([30, 60, 90])
  windowDays?: 30 | 60 | 90;
}

