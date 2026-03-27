import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class AutoGenerateScheduleSlotsDto {
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

  @ApiPropertyOptional({
    type: [String],
    description: 'Lista de funcoes desejadas para preencher automaticamente.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  functionNames?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Restricao opcional para responsabilidades existentes do ministerio.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  responsibilityIds?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  createMissingSlots?: boolean;
}

