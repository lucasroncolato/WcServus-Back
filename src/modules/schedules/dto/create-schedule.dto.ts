import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty()
  @IsString()
  serviceId: string;

  @ApiProperty()
  @IsString()
  servantId: string;

  @ApiProperty()
  @IsString()
  sectorId: string;

  @ApiPropertyOptional({ description: 'ID relacional da equipe (canonico).' })
  @IsOptional()
  @IsString()
  teamId?: string;
}
