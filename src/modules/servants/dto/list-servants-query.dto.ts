import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ServantActiveStatusDto } from './create-servant.dto';

export class ListServantsQueryDto {
  @ApiPropertyOptional({ enum: ServantActiveStatusDto })
  @IsOptional()
  @IsEnum(ServantActiveStatusDto)
  status?: ServantActiveStatusDto;

  @ApiPropertyOptional({ enum: TrainingStatus })
  @IsOptional()
  @IsEnum(TrainingStatus)
  trainingStatus?: TrainingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sectorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
