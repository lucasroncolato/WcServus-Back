import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class LinkUserServantDto {
  @ApiProperty({
    nullable: true,
    description: 'ID do servo a ser vinculado. Envie null para remover o vínculo.',
    example: 'clx9l8w7y0000xv9d28h2i6v7',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  servantId?: string | null;
}
