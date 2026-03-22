import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CheckInDto } from './check-in.dto';

export class BatchAttendanceDto {
  @ApiProperty({ type: [CheckInDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckInDto)
  records: CheckInDto[];
}