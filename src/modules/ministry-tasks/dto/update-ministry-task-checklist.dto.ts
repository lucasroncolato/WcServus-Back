import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MinistryTaskChecklistItemStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class UpdateMinistryTaskChecklistItemDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty({ enum: MinistryTaskChecklistItemStatus })
  @IsEnum(MinistryTaskChecklistItemStatus)
  status: MinistryTaskChecklistItemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string;
}

export class UpdateMinistryTaskChecklistDto {
  @ApiProperty({ type: [UpdateMinistryTaskChecklistItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateMinistryTaskChecklistItemDto)
  items: UpdateMinistryTaskChecklistItemDto[];
}
