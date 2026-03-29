import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GamificationActionType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class AwardPointsDto {
  @ApiProperty()
  @IsString()
  servantId: string;

  @ApiProperty({ enum: GamificationActionType })
  @IsEnum(GamificationActionType)
  actionType: GamificationActionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ministryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
