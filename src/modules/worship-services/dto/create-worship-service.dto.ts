import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorshipServiceStatus, WorshipServiceType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateWorshipServiceDto {
  @ApiProperty({ enum: WorshipServiceType })
  @IsEnum(WorshipServiceType)
  type: WorshipServiceType;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsDateString()
  serviceDate: string;

  @ApiProperty({ example: '19:30' })
  @IsString()
  startTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: WorshipServiceStatus })
  @IsOptional()
  @IsEnum(WorshipServiceStatus)
  status?: WorshipServiceStatus;
}