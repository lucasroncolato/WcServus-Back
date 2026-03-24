import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateWhatsappGlobalSettingDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}
