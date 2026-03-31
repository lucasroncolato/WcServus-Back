import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RunAutomationRuleTestDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceRefId?: string;
}
