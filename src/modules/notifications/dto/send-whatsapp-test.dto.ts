import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SendWhatsappTestDto {
  @ApiProperty({ example: '5511999999999' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Mensagem de teste do modulo de WhatsApp.' })
  @IsString()
  message: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  servantId?: string;
}
