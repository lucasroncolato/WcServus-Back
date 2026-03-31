import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreatePastoralFollowUpDto {
  @ApiProperty({ example: '2026-04-08T19:00:00.000Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ required: false, example: 'Revisar disponibilidade e rotina pessoal.' })
  @IsOptional()
  @IsString()
  notes?: string;
}