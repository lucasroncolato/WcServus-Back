import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectTalentDto {
  @ApiProperty({ description: 'Justificativa obrigatoria para reprovar talento.' })
  @IsString()
  @MinLength(5)
  reason: string;
}
