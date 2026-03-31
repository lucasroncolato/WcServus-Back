import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { MarkServiceAttendanceDto } from './mark-service-attendance.dto';

export class BulkMarkServiceAttendanceDto {
  @ApiProperty({ type: [MarkServiceAttendanceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkServiceAttendanceDto)
  records: MarkServiceAttendanceDto[];
}
