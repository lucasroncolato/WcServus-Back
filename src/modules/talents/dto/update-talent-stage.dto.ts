import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { TalentStage } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateTalentStageDto {
  @ApiProperty({ enum: TalentStage, example: TalentStage.EM_AVALIACAO })
  @IsEnum(TalentStage)
  stage: TalentStage;

  @ApiPropertyOptional({ example: 'Demonstrou evolução técnica no último mês.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
