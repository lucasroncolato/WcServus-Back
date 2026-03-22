import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

export class LinkServantUserDto {
  @ApiProperty({
    nullable: true,
    description: 'ID do usuário para vincular ao servo. Envie null para remover vínculo.',
    example: 'clx9l8w7y0000xv9d28h2i6v7',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  userId?: string | null;
}
