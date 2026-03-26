import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportRequestType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSupportRequestDto {
  @ApiProperty({ enum: SupportRequestType })
  @IsEnum(SupportRequestType)
  type: SupportRequestType;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  subject: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}
