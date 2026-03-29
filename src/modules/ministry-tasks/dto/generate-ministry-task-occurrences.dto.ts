import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class GenerateMinistryTaskOccurrencesDto {
  @ApiProperty()
  @IsDateString()
  fromDate: string;

  @ApiProperty()
  @IsDateString()
  toDate: string;
}
