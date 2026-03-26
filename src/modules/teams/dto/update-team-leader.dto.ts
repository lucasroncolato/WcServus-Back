import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateTeamLeaderDto {
  @ApiPropertyOptional({ nullable: true, description: 'Informe null para remover o líder atual.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  leaderUserId?: string | null;
}
