import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateChurchSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  operationalWeekStartsOn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  defaultJourneyEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireScheduleConfirmation?: boolean;
}

export class UpdateChurchBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  secondaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  accentColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  welcomeMessage?: string;
}

export class UpsertChurchModuleDto {
  @IsString()
  moduleKey!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class UpdateChurchAutomationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  overdueGraceDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  stalledTrackDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  noServiceAlertDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  incompleteScheduleWindowHrs?: number;
}
