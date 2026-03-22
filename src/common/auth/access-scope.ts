import { ForbiddenException } from '@nestjs/common';
import { Prisma, PrismaClient, Role } from '@prisma/client';
import { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';

type Db = PrismaClient | { [K in keyof PrismaClient]: PrismaClient[K] };

export async function resolveScopedSectorIds(prisma: Db, actor: JwtPayload) {
  if (actor.role === Role.COORDENADOR) {
    const sectors = await prisma.sector.findMany({
      where: { coordinatorUserId: actor.sub },
      select: { id: true },
    });
    return sectors.map((sector) => sector.id);
  }

  if (actor.role === Role.LIDER) {
    if (!actor.servantId) {
      return [];
    }

    const actorServant = await prisma.servant.findUnique({
      where: { id: actor.servantId },
      select: {
        mainSectorId: true,
        servantSectors: {
          select: { sectorId: true },
        },
      },
    });

    if (!actorServant) {
      return [];
    }

    const ids = [
      ...(actorServant.mainSectorId ? [actorServant.mainSectorId] : []),
      ...actorServant.servantSectors.map((item) => item.sectorId),
    ];

    return [...new Set(ids)];
  }

  return [];
}

export async function getServantAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.ServantWhereInput | undefined> {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.SERVO) {
    return actor.servantId ? { id: actor.servantId } : { id: '__no_access__' };
  }

  if (actor.role === Role.COORDENADOR || actor.role === Role.LIDER) {
    const sectorIds = await resolveScopedSectorIds(prisma, actor);
    if (sectorIds.length === 0) {
      return { id: '__no_access__' };
    }

    return {
      OR: [
        { mainSectorId: { in: sectorIds } },
        { servantSectors: { some: { sectorId: { in: sectorIds } } } },
      ],
    };
  }

  return { id: '__no_access__' };
}

export async function getScheduleAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.ScheduleWhereInput | undefined> {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.SERVO) {
    return actor.servantId ? { servantId: actor.servantId } : { id: '__no_access__' };
  }

  if (actor.role === Role.COORDENADOR || actor.role === Role.LIDER) {
    const sectorIds = await resolveScopedSectorIds(prisma, actor);
    if (sectorIds.length === 0) {
      return { id: '__no_access__' };
    }

    return { sectorId: { in: sectorIds } };
  }

  return { id: '__no_access__' };
}

export async function getAttendanceAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.AttendanceWhereInput | undefined> {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.SERVO) {
    return actor.servantId ? { servantId: actor.servantId } : { id: '__no_access__' };
  }

  if (actor.role === Role.COORDENADOR || actor.role === Role.LIDER) {
    const sectorIds = await resolveScopedSectorIds(prisma, actor);
    if (sectorIds.length === 0) {
      return { id: '__no_access__' };
    }

    return {
      servant: {
        OR: [
          { mainSectorId: { in: sectorIds } },
          { servantSectors: { some: { sectorId: { in: sectorIds } } } },
        ],
      },
    };
  }

  return { id: '__no_access__' };
}

export async function getPastoralVisitAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.PastoralVisitWhereInput | undefined> {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.SERVO) {
    return actor.servantId ? { servantId: actor.servantId } : { id: '__no_access__' };
  }

  if (actor.role === Role.COORDENADOR || actor.role === Role.LIDER) {
    const sectorIds = await resolveScopedSectorIds(prisma, actor);
    if (sectorIds.length === 0) {
      return { id: '__no_access__' };
    }

    return {
      servant: {
        OR: [
          { mainSectorId: { in: sectorIds } },
          { servantSectors: { some: { sectorId: { in: sectorIds } } } },
        ],
      },
    };
  }

  return { id: '__no_access__' };
}

export async function assertSectorAccess(prisma: Db, actor: JwtPayload, sectorId: string) {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return;
  }

  const sectorIds = await resolveScopedSectorIds(prisma, actor);
  if (!sectorIds.includes(sectorId)) {
    throw new ForbiddenException('You do not have permission for this sector');
  }
}

export async function assertServantAccess(prisma: Db, actor: JwtPayload, servantId: string) {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return;
  }

  const where = await getServantAccessWhere(prisma, actor);
  const servant = await prisma.servant.findFirst({
    where: where ? { AND: [{ id: servantId }, where] } : { id: servantId },
    select: { id: true },
  });

  if (!servant) {
    throw new ForbiddenException('You do not have permission for this servant');
  }
}

