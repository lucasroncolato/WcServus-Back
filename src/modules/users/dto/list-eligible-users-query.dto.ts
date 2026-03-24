import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListEligibleUsersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  servantId?: string;
}
