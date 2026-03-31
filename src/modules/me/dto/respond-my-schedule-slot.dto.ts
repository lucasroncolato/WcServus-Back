import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum MyScheduleResponse {
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

export class RespondMyScheduleSlotDto {
  @ApiProperty()
  @IsString()
  slotId: string;

  @ApiProperty({ enum: [MyScheduleResponse.ACCEPTED, MyScheduleResponse.DECLINED] })
  @IsEnum(MyScheduleResponse)
  response: MyScheduleResponse;

  @ApiProperty({ required: false, description: 'Obrigatorio quando response=DECLINED' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declineReason?: string;
}
