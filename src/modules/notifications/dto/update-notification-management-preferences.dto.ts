import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class NotificationManagementPreferencesChannelsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  APP?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  EMAIL?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  WHATSAPP?: boolean;
}

export class UpdateNotificationManagementPreferencesDto {
  @ApiPropertyOptional({ type: NotificationManagementPreferencesChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationManagementPreferencesChannelsDto)
  channels?: NotificationManagementPreferencesChannelsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  receiveDigest?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  receiveOnlyOwnSector?: boolean;
}

