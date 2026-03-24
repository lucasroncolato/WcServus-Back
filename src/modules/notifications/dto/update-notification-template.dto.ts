import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationProvider, NotificationTemplateStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNotificationTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  eventKey?: string;

  @ApiPropertyOptional({ enum: NotificationProvider })
  @IsOptional()
  @IsEnum(NotificationProvider)
  provider?: NotificationProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: NotificationTemplateStatus })
  @IsOptional()
  @IsEnum(NotificationTemplateStatus)
  status?: NotificationTemplateStatus;
}
