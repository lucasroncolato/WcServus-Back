import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CheckInDto {
  @ApiProperty({ example: 'clx_service_1' })
  @IsString()
  serviceId: string;

  @ApiProperty({ example: 'clx_servant_1' })
  @IsString()
  servantId: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional({ example: 'Chegou atrasado por transito.' })
  @IsOptional()
  @IsString()
  justification?: string;

  @ApiPropertyOptional({ example: 'Registrado na entrada principal.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
