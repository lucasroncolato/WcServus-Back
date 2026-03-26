import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateNotificationManagementChannelDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

