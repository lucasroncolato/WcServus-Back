import { AutomationActionType, AutomationTriggerType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAutomationRuleDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: AutomationTriggerType })
  @IsEnum(AutomationTriggerType)
  triggerType!: AutomationTriggerType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;

  @ApiProperty({ enum: AutomationActionType })
  @IsEnum(AutomationActionType)
  actionType!: AutomationActionType;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  actionConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Only for SUPER_ADMIN when operating across churches' })
  @IsOptional()
  @IsString()
  churchId?: string;
}
