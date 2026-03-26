import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum TalentReviewDecisionDto {
  CONFIRM_REJECTION = 'CONFIRM_REJECTION',
  REVERSE_REJECTION = 'REVERSE_REJECTION',
}

export class ReviewRejectedTalentDto {
  @ApiProperty({ enum: TalentReviewDecisionDto })
  @IsEnum(TalentReviewDecisionDto)
  decision: TalentReviewDecisionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
