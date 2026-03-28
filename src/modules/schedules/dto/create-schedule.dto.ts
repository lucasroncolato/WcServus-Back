import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty()
  @IsString()
  serviceId: string;

  @ApiProperty()
  @IsString()
  servantId: string;

  @ApiPropertyOptional({ description: 'ID do ministerio da escala.' })
  @IsOptional()
  @IsString()
  ministryId?: string;

  @ApiPropertyOptional({ description: 'ID relacional da equipe (canonico).' })
  @IsOptional()
  @IsString()
  teamId?: string;
}
