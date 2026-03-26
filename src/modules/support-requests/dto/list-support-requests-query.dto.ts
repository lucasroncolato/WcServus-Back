import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupportRequestStatus, SupportRequestType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListSupportRequestsQueryDto {
  @ApiPropertyOptional({ enum: SupportRequestStatus })
  @IsOptional()
  @IsEnum(SupportRequestStatus)
  status?: SupportRequestStatus;

  @ApiPropertyOptional({ enum: SupportRequestType })
  @IsOptional()
  @IsEnum(SupportRequestType)
  type?: SupportRequestType;
}
