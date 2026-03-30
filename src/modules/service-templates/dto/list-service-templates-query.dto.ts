import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceTemplateRecurrenceType, WorshipServiceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class ListServiceTemplatesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return value === true || value === 'true';
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ enum: WorshipServiceType })
  @IsOptional()
  @IsEnum(WorshipServiceType)
  type?: WorshipServiceType;

  @ApiPropertyOptional({ enum: ServiceTemplateRecurrenceType })
  @IsOptional()
  @IsEnum(ServiceTemplateRecurrenceType)
  recurrenceType?: ServiceTemplateRecurrenceType;
}
