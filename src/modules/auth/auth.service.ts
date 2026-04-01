import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuditAction,
  PasswordResetToken,
  PermissionEffect,
  Role,
  ServantStatus,
  UserScope,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { capabilitiesForRole } from 'src/common/auth/role-capabilities';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        role: true,
        scope: true,
        status: true,
        mustChangePassword: true,
        passwordHash: true,
        servantId: true,
        churchId: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role === Role.SERVO && !user.servantId) {
      throw new UnauthorizedException('SERVO account must be linked to a servant');
    }

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const session = await this.createSession({
      id: user.id,
      email: user.email,
      role: user.role,
      servantId: user.servantId,
      churchId: user.churchId,
      mustChangePassword: user.mustChangePassword,
    });

    await this.auditService.log({
      action: AuditAction.USER_LOGIN,
      entity: 'Auth',
      entityId: user.id,
      userId: user.id,
      metadata: {
        role: user.role,
        churchId: user.churchId ?? null,
      },
    });

    return session;
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = this.verifyRefreshToken(dto.refreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        scope: true,
        status: true,
        mustChangePassword: true,
        servantId: true,
        churchId: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (user.role === Role.SERVO && !user.servantId) {
      throw new UnauthorizedException('SERVO account must be linked to a servant');
    }

    const matchedToken = await this.findValidRefreshTokenRecord(
      user.id,
      dto.refreshToken,
      payload.tid,
    );

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

    const matchedToken = await this.findValidRefreshTokenRecord(
      payload.sub,
      dto.refreshToken,
      payload.tid,
    );
    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      action: AuditAction.USER_LOGOUT,
      entity: 'Auth',
      entityId: payload.sub,
      userId: payload.sub,
      metadata: {
        refreshTokenId: matchedToken.id,
      },
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
        data: { passwordHash: newPasswordHash, mustChangePassword: false },
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

    const rawTokenSecret = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawTokenSecret, 10);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    const resetRecord = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Canonical reset token format: <resetTokenId>.<rawSecret>.
    // Delivery is handled outside this service; legacy fallback remains supported in resetPassword.
    void `${resetRecord.id}.${rawTokenSecret}`;

    return { message: 'If this email exists, a reset token was generated.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const matchedRecord = await this.findValidPasswordResetRecord(dto.token);
    if (!matchedRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: matchedRecord.userId },
        data: { passwordHash: newHash, mustChangePassword: false },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: matchedRecord.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: matchedRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.notificationsService.create({
      userId: matchedRecord.userId,
      type: 'USER_PASSWORD_RESET',
      title: 'Senha redefinida',
      message: 'Sua senha foi redefinida com sucesso.',
      link: '/auth/me',
    });

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
        scope: true,
        status: true,
        mustChangePassword: true,
        phone: true,
        avatarUrl: true,
        servantId: true,
        servant: {
          select: {
            id: true,
            name: true,
            status: true,
            trainingStatus: true,
            teamId: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
            mainMinistryId: true,
            mainMinistry: {
              select: {
                id: true,
                name: true,
              },
            },
            servantMinistries: {
              select: {
                ministry: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        coordinatedMinistries: {
          select: {
            id: true,
            name: true,
          },
        },
        scopeBindings: {
          select: {
            ministryId: true,
            teamId: true,
            ministry: {
              select: {
                id: true,
                name: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    const linkedSector =
      account.servant?.mainMinistry ??
      account.servant?.servantMinistries[0]?.ministry ??
      account.coordinatedMinistries[0] ??
      null;

    const ministryIds = [
      ...new Set(
        account.scopeBindings
          .map((binding) => binding.ministryId ?? binding.ministry?.id ?? null)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const teamIds = [
      ...new Set(
        account.scopeBindings
          .map((binding) => binding.teamId ?? binding.team?.id ?? null)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const capabilities = await this.resolveUserCapabilities(account.id, account.role);

    return {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      scope: account.scope,
      scopeType: account.scope,
      ministryIds,
      teamIds,
      ministryId: account.servant?.mainMinistryId ?? ministryIds[0] ?? null,
      teamId: account.servant?.teamId ?? teamIds[0] ?? null,
      status: account.status,
      mustChangePassword: account.mustChangePassword,
      phone: account.phone,
      avatarUrl: account.avatarUrl,
      servantId: account.servantId,
      servant: account.servant
        ? {
            id: account.servant.id,
            name: account.servant.name,
            status: account.servant.status,
            statusView:
              account.servant.status === ServantStatus.ATIVO ? 'ACTIVE' : 'INACTIVE',
            trainingStatus: account.servant.trainingStatus,
            teamId: account.servant.teamId,
            teamName: account.servant.team?.name ?? null,
            team: account.servant.team,
            mainMinistryId: account.servant.mainMinistryId,
            ministries: account.servant.servantMinistries.map((x) => x.ministry),
          }
        : null,
      linkedSector,
      permissions: this.resolvePermissions(account.role, account.scope),
      capabilities,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  async capabilities(userId: string) {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!account) {
      throw new UnauthorizedException('Invalid user');
    }

    const capabilities = await this.resolveUserCapabilities(account.id, account.role);
    return {
      role: account.role,
      capabilities,
      capabilityVersion: '2026-03-rbac-unified',
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
    churchId?: string | null;
    mustChangePassword?: boolean;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      servantId: user.servantId ?? null,
      churchId: user.churchId ?? null,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'access-secret'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshExpiresInMs = this.getRefreshExpirationMillis(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: '__PENDING_HASH__',
        expiresAt: new Date(Date.now() + refreshExpiresInMs),
      },
      select: { id: true },
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        ...payload,
        tid: refreshTokenRecord.id,
      },
      {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'refresh-secret'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: {
        tokenHash: refreshTokenHash,
      },
    });

    const account = await this.me(user.id);

    return { accessToken, refreshToken, user: account };
  }

  private resolvePermissions(role: Role, scope: UserScope = UserScope.GLOBAL) {
    if (role === Role.SUPER_ADMIN) {
      return {
        scope,
        canManageUsers: true,
        canManageServants: true,
        canManageSchedules: true,
        canViewReports: true,
        canViewPastoralData: true,
      };
    }

    if (role === Role.ADMIN) {
      return {
        scope,
        canManageUsers: true,
        canManageServants: true,
        canManageSchedules: true,
        canViewReports: true,
        canViewPastoralData: true,
      };
    }

    if (role === Role.PASTOR) {
      return {
        scope,
        canManageUsers: false,
        canManageServants: false,
        canManageSchedules: false,
        canViewReports: true,
        canViewPastoralData: true,
      };
    }

    if (role === Role.COORDENADOR) {
      return {
        scope,
        canManageUsers: false,
        canManageServants: true,
        canManageSchedules: true,
        canViewReports: true,
        canViewPastoralData: true,
      };
    }

    return {
      scope,
      canManageUsers: false,
      canManageServants: false,
      canManageSchedules: false,
      canViewReports: false,
      canViewPastoralData: false,
    };
  }

  private async resolveUserCapabilities(userId: string, role: Role) {
    const base = new Set(capabilitiesForRole(role));
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { userId },
      select: {
        permissionKey: true,
        effect: true,
      },
    });

    for (const override of overrides) {
      const key = override.permissionKey as string;
      if (override.effect === PermissionEffect.ALLOW) {
        base.add(key as any);
      } else {
        base.delete(key as any);
      }
    }

    return [...base.values()];
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

  private async findValidRefreshTokenRecord(
    userId: string,
    rawToken: string,
    tokenId?: string,
  ) {
    if (tokenId) {
      const token = await this.prisma.refreshToken.findFirst({
        where: {
          id: tokenId,
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (token) {
        const valid = await bcrypt.compare(rawToken, token.tokenHash);
        if (valid) {
          return token;
        }
      }

      // Canonical refresh tokens include `tid` and must match the same DB record.
      // Do not fallback to "any active token" lookup, otherwise a revoked token
      // could be validated against another active token hash from the same user.
      return null;
    }

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

  private async findValidPasswordResetRecord(rawToken: string): Promise<PasswordResetToken | null> {
    const parsedToken = this.parseResetToken(rawToken);
    if (parsedToken) {
      const token = await this.prisma.passwordResetToken.findFirst({
        where: {
          id: parsedToken.tokenId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (token) {
        const valid = await bcrypt.compare(parsedToken.secret, token.tokenHash);
        if (valid) {
          return token;
        }
      }
    }

    const tokenRecords = await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const record of tokenRecords) {
      const valid = await bcrypt.compare(rawToken, record.tokenHash);
      if (valid) {
        return record;
      }
    }

    return null;
  }

  private parseResetToken(rawToken: string): { tokenId: string; secret: string } | null {
    const separator = rawToken.indexOf('.');
    if (separator <= 0 || separator >= rawToken.length - 1) {
      return null;
    }

    return {
      tokenId: rawToken.slice(0, separator),
      secret: rawToken.slice(separator + 1),
    };
  }
}



