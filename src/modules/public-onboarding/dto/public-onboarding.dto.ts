import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class PublicOnboardingChurchDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  churchName!: string;

  @ApiProperty()
  @IsEmail()
  adminEmail!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  adminName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  state?: string;
}

export class PublicOnboardingSetupDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  churchId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  welcomeMessage?: string;
}
