import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceTemplateRecurrenceType, WorshipServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateServiceTemplateSlotDto {
  @ApiProperty()
  @IsString()
  ministryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibilityId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requiredTalentId?: string;
}

export class CreateServiceTemplateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: WorshipServiceType })
  @IsEnum(WorshipServiceType)
  type: WorshipServiceType;

  @ApiProperty({ enum: ServiceTemplateRecurrenceType })
  @IsEnum(ServiceTemplateRecurrenceType)
  recurrenceType: ServiceTemplateRecurrenceType;

  @ApiProperty({ description: '0=Domingo ... 6=Sabado' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty({ example: '19:30' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'Duracao em minutos' })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(600)
  duration: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  generateAheadDays?: number;

  @ApiPropertyOptional({ type: [CreateServiceTemplateSlotDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceTemplateSlotDto)
  slots?: CreateServiceTemplateSlotDto[];
}
