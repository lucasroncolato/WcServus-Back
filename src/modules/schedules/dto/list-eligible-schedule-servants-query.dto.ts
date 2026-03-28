import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ListEligibleScheduleServantsQueryDto {
  @ApiProperty()
  @IsString()
  serviceId: string;

  @ApiPropertyOptional({ description: 'Ministerio alvo da elegibilidade.' })
  @IsOptional()
  @IsString()
  ministryId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeReasons?: boolean;
}
