import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { TalentStage } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateTalentStageDto {
  @ApiProperty({ enum: TalentStage })
  @IsEnum(TalentStage)
  stage: TalentStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}