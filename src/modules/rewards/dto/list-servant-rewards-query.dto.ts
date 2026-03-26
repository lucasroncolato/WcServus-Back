import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListServantRewardsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servantId?: string;
}
