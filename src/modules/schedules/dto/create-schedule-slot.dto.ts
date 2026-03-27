import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateScheduleSlotDto {
  @ApiPropertyOptional({ description: 'Compatibilidade legado.' })
  @IsOptional()
  @IsString()
  sectorId?: string;

  @ApiPropertyOptional({ description: 'Nomenclatura oficial do dominio.' })
  @IsOptional()
  @IsString()
  ministryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibilityId?: string;

  @ApiProperty({ description: 'Nome da funcao operacional da vaga.' })
  @IsString()
  functionName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slotLabel?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiredTraining?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  blocked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  blockedReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

