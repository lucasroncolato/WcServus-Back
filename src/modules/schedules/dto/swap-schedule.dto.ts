import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class SwapScheduleDto {
  @ApiPropertyOptional({ description: 'Modo novo: id da escala a ser trocada' })
  @IsOptional()
  @IsString()
  scheduleId?: string;

  @ApiPropertyOptional({ description: 'Modo novo: novo servo da escala' })
  @IsOptional()
  @IsString()
  servantId?: string;

  @ApiProperty({ description: 'Modo legado: escala origem' })
  @IsString()
  @IsOptional()
  fromScheduleId?: string;

  @ApiProperty({ description: 'Modo legado: escala destino' })
  @IsString()
  @IsOptional()
  toScheduleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
