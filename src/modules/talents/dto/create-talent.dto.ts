import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TalentStage } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateTalentDto {
  @ApiProperty()
  @IsString()
  servantId: string;

  @ApiProperty({ enum: TalentStage })
  @IsEnum(TalentStage)
  stage: TalentStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}