import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        passwordHash: true,
        servantId: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createSession({
      id: user.id,
      email: user.email,
      role: user.role,
      servantId: user.servantId,
    });
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = this.verifyRefreshToken(dto.refreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        servantId: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matchedToken = await this.findValidRefreshTokenRecord(user.id, dto.refreshToken);

    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.createSession(user);
  }

  async logout(dto: RefreshTokenDto, currentUserId?: string) {
    const payload = this.verifyRefreshToken(dto.refreshToken);

    if (currentUserId && payload.sub !== currentUserId) {
      throw new ForbiddenException('Refresh token does not belong to authenticated user');
    }

    const matchedToken = await this.findValidRefreshTokenRecord(payload.sub, dto.refreshToken);
    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, passwordHash: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user');
    }

    const validCurrentPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!validCurrentPassword) {
      throw new BadRequestException('Current password is invalid');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      return { message: 'If this email exists, a reset token was generated.' };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return { message: 'If this email exists, a reset token was generated.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenRecords = await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    let matchedRecordId: string | null = null;
    let userId: string | null = null;

    for (const record of tokenRecords) {
      const valid = await bcrypt.compare(dto.token, record.tokenHash);
      if (valid) {
        matchedRecordId = record.id;
        userId = record.userId;
        break;
      }
    }

    if (!matchedRecordId || !userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: matchedRecordId },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async me(userId: string) {
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        servantId: true,
        servant: {
          select: {
            id: true,
            name: true,
            status: true,
            trainingStatus: true,
            mainSectorId: true,
            mainSector: {
              select: {
                id: true,
                name: true,
              },
            },
            servantSectors: {
              select: {
                sector: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        coordinatedSectors: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    const linkedSector =
      account.servant?.mainSector ??
      account.servant?.servantSectors[0]?.sector ??
      account.coordinatedSectors[0] ??
      null;

    return {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      status: account.status,
      phone: account.phone,
      servantId: account.servantId,
      servant: account.servant
        ? {
            id: account.servant.id,
            name: account.servant.name,
            status: account.servant.status,
            trainingStatus: account.servant.trainingStatus,
            mainSectorId: account.servant.mainSectorId,
            sectors: account.servant.servantSectors.map((x) => x.sector),
          }
        : null,
      linkedSector,
      permissions: this.resolvePermissions(account.role),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private verifyRefreshToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async createSession(user: {
    id: string;
    email: string;
    role: JwtPayload['role'];
    servantId?: string | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      servantId: user.servantId ?? null,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'access-secret'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshExpiresInMs = this.getRefreshExpirationMillis(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + refreshExpiresInMs),
      },
    });

    const account = await this.me(user.id);

    return { accessToken, refreshToken, user: account };
  }

  private resolvePermissions(role: Role) {
    if (role === Role.SUPER_ADMIN) {
      return {
        scope: 'GLOBAL',
        canManageUsers: true,
        canManageServants: true,
        canManageSchedules: true,
        canViewReports: true,
        canViewPastoralData: true,
      };
    }

    if (role === Role.ADMIN) {
      return {
        scope: 'GLOBAL',
        canManageUsers: true,
        canManageServants: true,
        canManageSchedules: true,
        canViewReports: true,
        canViewPastoralData: true,
      };
    }

    if (role === Role.PASTOR) {
      return {
        scope: 'GLOBAL_PASTORAL',
        canManageUsers: false,
        canManageServants: true,
        canManageSchedules: false,
        canViewReports: true,
        canViewPastoralData: true,
      };
    }

    if (role === Role.COORDENADOR) {
      return {
        scope: 'SECTOR',
        canManageUsers: false,
        canManageServants: true,
        canManageSchedules: true,
        canViewReports: true,
        canViewPastoralData: true,
      };
    }

    if (role === Role.LIDER) {
      return {
        scope: 'TEAM',
        canManageUsers: false,
        canManageServants: true,
        canManageSchedules: true,
        canViewReports: false,
        canViewPastoralData: false,
      };
    }

    return {
      scope: 'SELF',
      canManageUsers: false,
      canManageServants: false,
      canManageSchedules: false,
      canViewReports: false,
      canViewPastoralData: false,
    };
  }

  private getRefreshExpirationMillis(raw: string): number {
    const value = Number.parseInt(raw.slice(0, -1), 10);
    const unit = raw.slice(-1);

    if (Number.isNaN(value)) {
      return 1000 * 60 * 60 * 24 * 7;
    }

    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      default:
        return 1000 * 60 * 60 * 24 * 7;
    }
  }

  private async findValidRefreshTokenRecord(userId: string, rawToken: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const token of tokens) {
      const valid = await bcrypt.compare(rawToken, token.tokenHash);
      if (valid) {
        return token;
      }
    }

    return null;
  }
}
