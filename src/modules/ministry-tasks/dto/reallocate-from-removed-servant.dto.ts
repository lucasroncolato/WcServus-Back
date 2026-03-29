import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MinistryTaskReallocationMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class MinistryTaskManualReassignmentItemDto {
  @ApiProperty()
  @IsString()
  occurrenceId: string;

  @ApiProperty()
  @IsString()
  newAssignedServantId: string;
}

export class ReallocateFromRemovedServantDto {
  @ApiProperty()
  @IsString()
  serviceId: string;

  @ApiProperty()
  @IsString()
  removedServantId: string;

  @ApiPropertyOptional({ enum: MinistryTaskReallocationMode, default: MinistryTaskReallocationMode.MANUAL })
  @IsOptional()
  @IsEnum(MinistryTaskReallocationMode)
  mode?: MinistryTaskReallocationMode;

  @ApiPropertyOptional({ type: [MinistryTaskManualReassignmentItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => MinistryTaskManualReassignmentItemDto)
  manualAssignments?: MinistryTaskManualReassignmentItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
