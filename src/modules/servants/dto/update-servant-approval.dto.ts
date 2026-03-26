import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ServantApprovalActionDto {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class UpdateServantApprovalDto {
  @ApiProperty({ enum: ServantApprovalActionDto })
  @IsEnum(ServantApprovalActionDto)
  action: ServantApprovalActionDto;

  @ApiPropertyOptional({ description: 'Motivo para aprovacao/rejeicao.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
