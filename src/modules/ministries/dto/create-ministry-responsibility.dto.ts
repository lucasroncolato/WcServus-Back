import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Aptitude } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMinistryResponsibilityDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activity?: string;

  @ApiPropertyOptional({ description: 'Funcao ou papel esperado.' })
  @IsOptional()
  @IsString()
  functionName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibleServantId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiredTraining?: boolean;

  @ApiPropertyOptional({ enum: Aptitude })
  @IsOptional()
  @IsEnum(Aptitude)
  requiredAptitude?: Aptitude;
}
