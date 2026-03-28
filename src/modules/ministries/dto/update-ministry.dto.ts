import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateMinistryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coordinatorUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  popText?: string;

  @ApiPropertyOptional({ description: 'Alias de popText para contrato do frontend atual' })
  @IsOptional()
  @IsString()
  pop?: string;

  @ApiPropertyOptional({ type: [String], description: 'Vincula servos ao ministerio na edicao' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servantIds?: string[];
}
