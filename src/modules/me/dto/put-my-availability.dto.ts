import { ApiProperty } from '@nestjs/swagger';
import { Shift } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class AvailabilityItemDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0=Domingo ... 6=Sabado' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ enum: Shift })
  @IsEnum(Shift)
  shift: Shift;

  @ApiProperty({ default: true })
  @IsBoolean()
  available: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PutMyAvailabilityDto {
  @ApiProperty({ type: [AvailabilityItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityItemDto)
  items: AvailabilityItemDto[];
}
