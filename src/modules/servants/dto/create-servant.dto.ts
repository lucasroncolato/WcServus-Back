import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Aptitude, Gender, TrainingStatus } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum ServantActiveStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateServantDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

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

  @ApiPropertyOptional({
    enum: ServantActiveStatusDto,
    default: ServantActiveStatusDto.ACTIVE,
    description: 'Status inicial administrativo do servo.',
  })
  @IsOptional()
  @IsEnum(ServantActiveStatusDto)
  status?: ServantActiveStatusDto;

  @ApiPropertyOptional({
    enum: TrainingStatus,
    default: TrainingStatus.PENDING,
    description: 'Status inicial de treinamento.',
  })
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

  @ApiPropertyOptional({ type: [String], description: 'Lista de setores do servo. O primeiro vira setor principal.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ministryIds?: string[];

  @ApiPropertyOptional({ description: 'Retrocompatibilidade. Se enviado sem ministryIds, vira setor principal.' })
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

