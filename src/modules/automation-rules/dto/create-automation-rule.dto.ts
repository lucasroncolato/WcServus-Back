import { AutomationActionType, AutomationDedupeStrategy, AutomationRuleSeverity, AutomationTriggerType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

  @ApiProperty({ example: 'daily' })
  @IsString()
  @IsNotEmpty()
  triggerKey!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  conditionConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: AutomationActionType, description: 'Campo legado para compatibilidade' })
  @IsOptional()
  @IsEnum(AutomationActionType)
  actionType?: AutomationActionType;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        config: { type: 'object' },
      },
    },
  })
  @IsArray()
  actionConfig!: Array<{ action: string; config?: Record<string, unknown> }>;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownMinutes?: number;

  @ApiPropertyOptional({ enum: AutomationDedupeStrategy, default: AutomationDedupeStrategy.BY_EVENT })
  @IsOptional()
  @IsEnum(AutomationDedupeStrategy)
  dedupeStrategy?: AutomationDedupeStrategy;

  @ApiPropertyOptional({ enum: AutomationRuleSeverity, default: AutomationRuleSeverity.MEDIUM })
  @IsOptional()
  @IsEnum(AutomationRuleSeverity)
  severity?: AutomationRuleSeverity;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Only for SUPER_ADMIN when operating across churches' })
  @IsOptional()
  @IsString()
  churchId?: string;
}
