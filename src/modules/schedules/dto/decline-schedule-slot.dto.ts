import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeclineScheduleSlotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
