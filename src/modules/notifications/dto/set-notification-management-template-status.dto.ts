import { IsBoolean } from 'class-validator';

export class SetNotificationManagementTemplateStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
