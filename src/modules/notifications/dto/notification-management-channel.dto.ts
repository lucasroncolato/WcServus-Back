import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum NotificationManagementChannel {
  APP = 'APP',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
}

export class NotificationManagementChannelParamDto {
  @ApiProperty({ enum: NotificationManagementChannel })
  @IsEnum(NotificationManagementChannel)
  channel: NotificationManagementChannel;
}

