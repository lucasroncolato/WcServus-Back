import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class SwapScheduleDto {
  @ApiProperty()
  @IsString()
  fromScheduleId: string;

  @ApiProperty()
  @IsString()
  toScheduleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}