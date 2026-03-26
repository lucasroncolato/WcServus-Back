import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevotionalStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class RegisterDailyDevotionalDto {
  @ApiPropertyOptional({
    description:
      'Obrigatorio para perfis administrativos. Para COORDENADOR/SERVO o backend usa sempre o proprio cadastro pessoal.',
  })
  @IsOptional()
  @IsString()
  servantId?: string;

  @ApiProperty({ example: '2026-03-26' })
  @IsDateString()
  devotionalDate: string;

  @ApiPropertyOptional({ enum: DevotionalStatus, default: DevotionalStatus.DONE })
  @IsOptional()
  @IsEnum(DevotionalStatus)
  status?: DevotionalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
