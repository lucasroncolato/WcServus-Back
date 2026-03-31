import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompletePastoralFollowUpDto {
  @ApiPropertyOptional({ example: 'Follow-up concluido com definicao de novos passos.' })
  @IsOptional()
  @IsString()
  notes?: string;
}