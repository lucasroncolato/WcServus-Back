import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class ServantUserIntegrityQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por igreja (churchId).' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  churchId?: string;

  @ApiPropertyOptional({ enum: ['blocking', 'manual_review'] })
  @IsOptional()
  @IsIn(['blocking', 'manual_review'])
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  severity?: 'blocking' | 'manual_review';
}
