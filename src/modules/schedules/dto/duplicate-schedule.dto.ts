import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DuplicateScheduleDto {
  @ApiProperty({
    description: 'ID do culto de destino para duplicar a escala.',
    example: 'clx_service_2',
  })
  @IsString()
  worshipServiceId: string;
}
