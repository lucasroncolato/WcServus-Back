import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AllowWhenPasswordChangeRequired } from 'src/common/decorators/allow-password-change-required.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './types/jwt-payload.type';

const AUTH_LOGIN_THROTTLE_LIMIT = Number(process.env.AUTH_LOGIN_THROTTLE_LIMIT ?? 30);
const AUTH_LOGIN_THROTTLE_TTL_MS = Number(process.env.AUTH_LOGIN_THROTTLE_TTL_MS ?? 60_000);

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: AUTH_LOGIN_THROTTLE_LIMIT, ttl: AUTH_LOGIN_THROTTLE_TTL_MS } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @AllowWhenPasswordChangeRequired()
  logout(@Body() dto: RefreshTokenDto, @CurrentUser() user: JwtPayload) {
    return this.authService.logout(dto, user.sub);
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @AllowWhenPasswordChangeRequired()
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  @ApiBearerAuth()
  @Get('capabilities')
  @AllowWhenPasswordChangeRequired()
  capabilities(@CurrentUser() user: JwtPayload) {
    return this.authService.capabilities(user.sub);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @AllowWhenPasswordChangeRequired()
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, dto);
  }
}
