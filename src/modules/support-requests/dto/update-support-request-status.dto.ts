import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateSupportRequestStatusDto {
  @ApiProperty({ enum: SupportRequestStatus })
  @IsEnum(SupportRequestStatus)
  status: SupportRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
