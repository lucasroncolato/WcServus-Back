import { ApiProperty } from '@nestjs/swagger';
import { ScheduleResponseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class RespondMyScheduleDto {
  @ApiProperty({ enum: [ScheduleResponseStatus.CONFIRMED, ScheduleResponseStatus.DECLINED] })
  @IsEnum(ScheduleResponseStatus)
  responseStatus: ScheduleResponseStatus;

  @ApiProperty({ required: false, description: 'Obrigatorio quando responseStatus=DECLINED' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declineReason?: string;
}
