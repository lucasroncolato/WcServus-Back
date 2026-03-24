import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationProvider, NotificationTemplateStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNotificationTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  eventKey: string;

  @ApiProperty({ enum: NotificationChannel, default: NotificationChannel.WHATSAPP })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional({ enum: NotificationProvider, default: NotificationProvider.MOCK })
  @IsOptional()
  @IsEnum(NotificationProvider)
  provider?: NotificationProvider;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({
    example: 'Ola {{userName}}, voce recebeu nova escala: {{message}}',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: NotificationTemplateStatus, default: NotificationTemplateStatus.ACTIVE })
  @IsOptional()
  @IsEnum(NotificationTemplateStatus)
  status?: NotificationTemplateStatus;
}
