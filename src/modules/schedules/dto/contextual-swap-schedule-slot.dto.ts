import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ScheduleSlotSwapContextDto {
  REPLACEMENT = 'REPLACEMENT',
  ABSENCE_REPLACEMENT = 'ABSENCE_REPLACEMENT',
  FILL_OPEN_SLOT = 'FILL_OPEN_SLOT',
}

export class ContextualSwapScheduleSlotDto {
  @ApiProperty()
  @IsString()
  substituteServantId: string;

  @ApiProperty({ enum: ScheduleSlotSwapContextDto, default: ScheduleSlotSwapContextDto.REPLACEMENT })
  @IsEnum(ScheduleSlotSwapContextDto)
  context: ScheduleSlotSwapContextDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

