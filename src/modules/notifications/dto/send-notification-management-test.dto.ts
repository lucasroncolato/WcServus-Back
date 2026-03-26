import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { NotificationManagementChannel } from './notification-management-channel.dto';

export class SendNotificationManagementTestDto {
  @ApiProperty({ enum: NotificationManagementChannel })
  @IsString()
  channel: NotificationManagementChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  event?: string;

  @ApiProperty({ example: '5511999999999' })
  @IsString()
  @MinLength(10)
  phoneDigits: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  message: string;
}

