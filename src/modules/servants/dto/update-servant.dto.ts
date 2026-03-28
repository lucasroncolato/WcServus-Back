import { ApiPropertyOptional } from '@nestjs/swagger';
import { Aptitude, Gender, TrainingStatus } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ServantActiveStatusDto } from './create-servant.dto';

export class UpdateServantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: ServantActiveStatusDto })
  @IsOptional()
  @IsEnum(ServantActiveStatusDto)
  status?: ServantActiveStatusDto;

  @ApiPropertyOptional({ enum: TrainingStatus })
  @IsOptional()
  @IsEnum(TrainingStatus)
  trainingStatus?: TrainingStatus;

  @ApiPropertyOptional({ enum: Aptitude })
  @IsOptional()
  @IsEnum(Aptitude)
  aptitude?: Aptitude;

  @ApiPropertyOptional({ description: 'ID da equipe relacional oficial.' })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Setores do servo. O primeiro vira setor principal.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ministryIds?: string[];

  @ApiPropertyOptional({ description: 'Retrocompatibilidade.' })
  @IsOptional()
  @IsString()
  mainMinistryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  joinedAt?: string;
}

