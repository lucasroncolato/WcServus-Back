import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CheckInDto } from './check-in.dto';

export class BatchAttendanceDto {
  @ApiProperty({
    type: [CheckInDto],
    example: [
      { serviceId: 'clx_service_1', servantId: 'clx_servant_1', status: 'PRESENTE' },
      { serviceId: 'clx_service_1', servantId: 'clx_servant_2', status: 'FALTA' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckInDto)
  records: CheckInDto[];
}
