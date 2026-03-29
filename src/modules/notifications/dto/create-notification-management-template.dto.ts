import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NotificationManagementChannel } from './notification-management-channel.dto';

export class CreateNotificationManagementTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  event!: string;

  @IsEnum(NotificationManagementChannel)
  channel!: NotificationManagementChannel;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
