import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ListEligibleScheduleServantsQueryDto {
  @ApiProperty()
  @IsString()
  serviceId: string;

  @ApiPropertyOptional({ description: 'Compatibilidade legado.' })
  @IsOptional()
  @IsString()
  sectorId?: string;

  @ApiPropertyOptional({ description: 'Nomenclatura oficial do dominio.' })
  @IsOptional()
  @IsString()
  ministryId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeReasons?: boolean;
}
