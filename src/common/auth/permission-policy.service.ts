import { Injectable } from '@nestjs/common';
import { PermissionEffect } from '@prisma/client';
import { Capability } from '../auth/capabilities';
import { capabilitiesForRole } from '../auth/role-capabilities';
import { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PermissionPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async hasCapabilities(user: JwtPayload, required: Capability[]) {
    if (required.length === 0) {
      return true;
    }

    const base = new Set(capabilitiesForRole(user.role));
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { userId: user.sub },
      select: { permissionKey: true, effect: true },
    });

    for (const override of overrides) {
      const key = override.permissionKey as Capability;
      if (override.effect === PermissionEffect.ALLOW) {
        base.add(key);
      } else {
        base.delete(key);
      }
    }

    return required.every((capability) => base.has(capability));
  }
}
