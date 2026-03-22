import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ServantActiveStatusDto } from './create-servant.dto';

export class UpdateServantStatusDto {
  @ApiProperty({ enum: ServantActiveStatusDto })
  @IsEnum(ServantActiveStatusDto)
  status: ServantActiveStatusDto;

  @ApiProperty()
  @IsOptional()
  @IsString()
  reason?: string;
}
