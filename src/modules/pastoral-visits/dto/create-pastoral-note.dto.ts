import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreatePastoralNoteDto {
  @ApiProperty({ example: 'Conversa realizada com acolhimento e plano de retorno gradual.' })
  @IsString()
  @MinLength(3)
  note: string;
}