import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotificationManagementChannel } from './notification-management-channel.dto';

export class UpdateNotificationManagementTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  event?: string;

  @IsOptional()
  @IsEnum(NotificationManagementChannel)
  channel?: NotificationManagementChannel;

  @IsOptional()
  @IsString()
  content?: string;
}
