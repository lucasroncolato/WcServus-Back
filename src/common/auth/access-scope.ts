import { ForbiddenException } from '@nestjs/common';
import { PermissionEffect, Prisma, PrismaClient, Role, UserScope } from '@prisma/client';
import { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';

type Db = PrismaClient | { [K in keyof PrismaClient]: PrismaClient[K] };

type ActorScopeContext = {
  scopeType: UserScope;
  sectorIds: string[];
  teamNames: string[];
  servantId: string | null;
  overrides: Record<string, PermissionEffect>;
};

const NO_ACCESS_SERVANT: Prisma.ServantWhereInput = { id: '__no_access__' };
const NO_ACCESS_SCHEDULE: Prisma.ScheduleWhereInput = { id: '__no_access__' };
const NO_ACCESS_ATTENDANCE: Prisma.AttendanceWhereInput = { id: '__no_access__' };
const NO_ACCESS_PASTORAL: Prisma.PastoralVisitWhereInput = { id: '__no_access__' };
const NO_ACCESS_SECTOR: Prisma.SectorWhereInput = { id: '__no_access__' };

function unique(values: string[]) {
  return [...new Set(values)];
}

async function getRoleBaselineSectorIds(prisma: Db, actor: JwtPayload) {
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

    return unique([
      ...(actorServant.mainSectorId ? [actorServant.mainSectorId] : []),
      ...actorServant.servantSectors.map((item) => item.sectorId),
    ]);
  }

  return [];
}

async function loadActorScopeContext(prisma: Db, actor: JwtPayload): Promise<ActorScopeContext> {
  const user = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: {
      scope: true,
      servantId: true,
      scopeBindings: {
        select: {
          sectorId: true,
          teamName: true,
        },
      },
      permissionOverrides: {
        select: {
          permissionKey: true,
          effect: true,
        },
      },
    },
  });

  if (!user) {
    const fallbackScope =
      actor.role === Role.SERVO
        ? UserScope.SELF
        : actor.role === Role.COORDENADOR || actor.role === Role.LIDER
          ? UserScope.SETOR
          : UserScope.GLOBAL;
    return {
      scopeType: fallbackScope,
      sectorIds: await getRoleBaselineSectorIds(prisma, actor),
      teamNames: [],
      servantId: actor.servantId ?? null,
      overrides: {},
    };
  }

  const scopeBindings = user.scopeBindings ?? [];
  const permissionOverrides = user.permissionOverrides ?? [];
  const effectiveScope =
    user.scope ??
    (actor.role === Role.SERVO
      ? UserScope.SELF
      : actor.role === Role.COORDENADOR || actor.role === Role.LIDER
        ? UserScope.SETOR
        : UserScope.GLOBAL);

  const sectorIds = unique(
    scopeBindings
      .map((binding) => binding.sectorId)
      .filter((value): value is string => Boolean(value)),
  );
  const teamNames = unique(
    scopeBindings
      .map((binding) => binding.teamName)
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => value.trim()),
  );

  if (
    (effectiveScope === UserScope.SETOR || effectiveScope === UserScope.EQUIPE) &&
    sectorIds.length === 0 &&
    teamNames.length === 0 &&
    (actor.role === Role.COORDENADOR || actor.role === Role.LIDER)
  ) {
    const fallbackSectorIds = await getRoleBaselineSectorIds(prisma, actor);
    return {
      scopeType: effectiveScope,
      sectorIds: fallbackSectorIds,
      teamNames: [],
      servantId: user.servantId ?? actor.servantId ?? null,
      overrides: Object.fromEntries(
        permissionOverrides.map((item) => [item.permissionKey, item.effect]),
      ),
    };
  }

  return {
    scopeType: effectiveScope,
    sectorIds,
    teamNames,
    servantId: user.servantId ?? actor.servantId ?? null,
    overrides: Object.fromEntries(permissionOverrides.map((item) => [item.permissionKey, item.effect])),
  };
}

function combineWhere<T>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }

  return { AND: [a, b] } as T;
}

function getRoleBaselineServantWhere(
  actor: JwtPayload,
  roleSectorIds: string[],
): Prisma.ServantWhereInput | undefined {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.SERVO) {
    return actor.servantId ? { id: actor.servantId } : NO_ACCESS_SERVANT;
  }

  if (actor.role === Role.COORDENADOR || actor.role === Role.LIDER) {
    if (roleSectorIds.length === 0) {
      return NO_ACCESS_SERVANT;
    }

    return {
      OR: [
        { mainSectorId: { in: roleSectorIds } },
        { servantSectors: { some: { sectorId: { in: roleSectorIds } } } },
      ],
    };
  }

  return NO_ACCESS_SERVANT;
}

function getRoleBaselineScheduleWhere(
  actor: JwtPayload,
  roleSectorIds: string[],
): Prisma.ScheduleWhereInput | undefined {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.SERVO) {
    return actor.servantId ? { servantId: actor.servantId } : NO_ACCESS_SCHEDULE;
  }

  if (actor.role === Role.COORDENADOR || actor.role === Role.LIDER) {
    if (roleSectorIds.length === 0) {
      return NO_ACCESS_SCHEDULE;
    }
    return { sectorId: { in: roleSectorIds } };
  }

  return NO_ACCESS_SCHEDULE;
}

function getRoleBaselineSectorWhere(
  actor: JwtPayload,
  roleSectorIds: string[],
): Prisma.SectorWhereInput | undefined {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.COORDENADOR || actor.role === Role.LIDER) {
    if (roleSectorIds.length === 0) {
      return NO_ACCESS_SECTOR;
    }
    return { id: { in: roleSectorIds } };
  }

  return NO_ACCESS_SECTOR;
}

function getScopeServantWhere(ctx: ActorScopeContext): Prisma.ServantWhereInput | undefined {
  if (ctx.scopeType === UserScope.GLOBAL) {
    return undefined;
  }

  if (ctx.scopeType === UserScope.SELF) {
    return ctx.servantId ? { id: ctx.servantId } : NO_ACCESS_SERVANT;
  }

  if (ctx.scopeType === UserScope.SETOR) {
    if (ctx.sectorIds.length === 0) {
      return NO_ACCESS_SERVANT;
    }

    return {
      OR: [
        { mainSectorId: { in: ctx.sectorIds } },
        { servantSectors: { some: { sectorId: { in: ctx.sectorIds } } } },
      ],
    };
  }

  if (ctx.scopeType === UserScope.EQUIPE) {
    const conditions: Prisma.ServantWhereInput[] = [];
    if (ctx.sectorIds.length > 0) {
      conditions.push({
        OR: [
          { mainSectorId: { in: ctx.sectorIds } },
          { servantSectors: { some: { sectorId: { in: ctx.sectorIds } } } },
        ],
      });
    }

    if (ctx.teamNames.length > 0) {
      conditions.push({ classGroup: { in: ctx.teamNames } });
    }

    return conditions.length > 0 ? { OR: conditions } : NO_ACCESS_SERVANT;
  }

  return NO_ACCESS_SERVANT;
}

function getScopeScheduleWhere(ctx: ActorScopeContext): Prisma.ScheduleWhereInput | undefined {
  if (ctx.scopeType === UserScope.GLOBAL) {
    return undefined;
  }

  if (ctx.scopeType === UserScope.SELF) {
    return ctx.servantId ? { servantId: ctx.servantId } : NO_ACCESS_SCHEDULE;
  }

  if (ctx.scopeType === UserScope.SETOR) {
    return ctx.sectorIds.length > 0 ? { sectorId: { in: ctx.sectorIds } } : NO_ACCESS_SCHEDULE;
  }

  if (ctx.scopeType === UserScope.EQUIPE) {
    const conditions: Prisma.ScheduleWhereInput[] = [];
    if (ctx.sectorIds.length > 0) {
      conditions.push({ sectorId: { in: ctx.sectorIds } });
    }

    if (ctx.teamNames.length > 0) {
      conditions.push({ classGroup: { in: ctx.teamNames } });
      conditions.push({ servant: { classGroup: { in: ctx.teamNames } } });
    }

    return conditions.length > 0 ? { OR: conditions } : NO_ACCESS_SCHEDULE;
  }

  return NO_ACCESS_SCHEDULE;
}

function getScopeAttendanceWhere(ctx: ActorScopeContext): Prisma.AttendanceWhereInput | undefined {
  if (ctx.scopeType === UserScope.GLOBAL) {
    return undefined;
  }

  if (ctx.scopeType === UserScope.SELF) {
    return ctx.servantId ? { servantId: ctx.servantId } : NO_ACCESS_ATTENDANCE;
  }

  if (ctx.scopeType === UserScope.SETOR) {
    if (ctx.sectorIds.length === 0) {
      return NO_ACCESS_ATTENDANCE;
    }

    return {
      servant: {
        OR: [
          { mainSectorId: { in: ctx.sectorIds } },
          { servantSectors: { some: { sectorId: { in: ctx.sectorIds } } } },
        ],
      },
    };
  }

  if (ctx.scopeType === UserScope.EQUIPE) {
    const conditions: Prisma.ServantWhereInput[] = [];
    if (ctx.sectorIds.length > 0) {
      conditions.push({
        OR: [
          { mainSectorId: { in: ctx.sectorIds } },
          { servantSectors: { some: { sectorId: { in: ctx.sectorIds } } } },
        ],
      });
    }

    if (ctx.teamNames.length > 0) {
      conditions.push({ classGroup: { in: ctx.teamNames } });
    }

    return conditions.length > 0 ? { servant: { OR: conditions } } : NO_ACCESS_ATTENDANCE;
  }

  return NO_ACCESS_ATTENDANCE;
}

function getScopePastoralWhere(ctx: ActorScopeContext): Prisma.PastoralVisitWhereInput | undefined {
  if (ctx.scopeType === UserScope.GLOBAL) {
    return undefined;
  }

  if (ctx.scopeType === UserScope.SELF) {
    return ctx.servantId ? { servantId: ctx.servantId } : NO_ACCESS_PASTORAL;
  }

  if (ctx.scopeType === UserScope.SETOR) {
    if (ctx.sectorIds.length === 0) {
      return NO_ACCESS_PASTORAL;
    }

    return {
      servant: {
        OR: [
          { mainSectorId: { in: ctx.sectorIds } },
          { servantSectors: { some: { sectorId: { in: ctx.sectorIds } } } },
        ],
      },
    };
  }

  if (ctx.scopeType === UserScope.EQUIPE) {
    const conditions: Prisma.ServantWhereInput[] = [];
    if (ctx.sectorIds.length > 0) {
      conditions.push({
        OR: [
          { mainSectorId: { in: ctx.sectorIds } },
          { servantSectors: { some: { sectorId: { in: ctx.sectorIds } } } },
        ],
      });
    }

    if (ctx.teamNames.length > 0) {
      conditions.push({ classGroup: { in: ctx.teamNames } });
    }

    return conditions.length > 0 ? { servant: { OR: conditions } } : NO_ACCESS_PASTORAL;
  }

  return NO_ACCESS_PASTORAL;
}

function getScopeSectorWhere(ctx: ActorScopeContext): Prisma.SectorWhereInput | undefined {
  if (ctx.scopeType === UserScope.GLOBAL) {
    return undefined;
  }

  if (ctx.scopeType === UserScope.SELF) {
    return NO_ACCESS_SECTOR;
  }

  if (ctx.scopeType === UserScope.SETOR || ctx.scopeType === UserScope.EQUIPE) {
    return ctx.sectorIds.length > 0 ? { id: { in: ctx.sectorIds } } : NO_ACCESS_SECTOR;
  }

  return NO_ACCESS_SECTOR;
}

function getScopeUserWhere(ctx: ActorScopeContext, actor: JwtPayload): Prisma.UserWhereInput | undefined {
  if (ctx.scopeType === UserScope.GLOBAL) {
    return undefined;
  }

  if (ctx.scopeType === UserScope.SELF) {
    return { id: actor.sub };
  }

  const servantScope = getScopeServantWhere(ctx);
  if (!servantScope || servantScope === NO_ACCESS_SERVANT) {
    return { id: actor.sub };
  }

  return {
    OR: [{ id: actor.sub }, { servant: servantScope }],
  };
}

export async function resolveScopedSectorIds(prisma: Db, actor: JwtPayload) {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);

  const roleBaseline = getRoleBaselineSectorWhere(actor, roleSectorIds);
  const scopeBaseline = getScopeSectorWhere(ctx);
  const where = combineWhere(roleBaseline, scopeBaseline);

  if (!where) {
    const sectors = await prisma.sector.findMany({ select: { id: true } });
    return sectors.map((sector) => sector.id);
  }

  const sectors = await prisma.sector.findMany({
    where,
    select: { id: true },
  });
  return sectors.map((sector) => sector.id);
}

export async function getServantAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.ServantWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    getRoleBaselineServantWhere(actor, roleSectorIds),
    getScopeServantWhere(ctx),
  );
}

export async function getScheduleAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.ScheduleWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    getRoleBaselineScheduleWhere(actor, roleSectorIds),
    getScopeScheduleWhere(ctx),
  );
}

export async function getAttendanceAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.AttendanceWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR
      ? undefined
      : actor.role === Role.SERVO
        ? actor.servantId
          ? { servantId: actor.servantId }
          : NO_ACCESS_ATTENDANCE
        : roleSectorIds.length > 0
          ? {
              servant: {
                OR: [
                  { mainSectorId: { in: roleSectorIds } },
                  { servantSectors: { some: { sectorId: { in: roleSectorIds } } } },
                ],
              },
            }
          : NO_ACCESS_ATTENDANCE,
    getScopeAttendanceWhere(ctx),
  );
}

export async function getPastoralVisitAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.PastoralVisitWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR
      ? undefined
      : actor.role === Role.SERVO
        ? actor.servantId
          ? { servantId: actor.servantId }
          : NO_ACCESS_PASTORAL
        : roleSectorIds.length > 0
          ? {
              servant: {
                OR: [
                  { mainSectorId: { in: roleSectorIds } },
                  { servantSectors: { some: { sectorId: { in: roleSectorIds } } } },
                ],
              },
            }
          : NO_ACCESS_PASTORAL,
    getScopePastoralWhere(ctx),
  );
}

export async function getSectorAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.SectorWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    getRoleBaselineSectorWhere(actor, roleSectorIds),
    getScopeSectorWhere(ctx),
  );
}

export async function getUserAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.UserWhereInput | undefined> {
  const ctx = await loadActorScopeContext(prisma, actor);
  return getScopeUserWhere(ctx, actor);
}

export async function assertSectorAccess(prisma: Db, actor: JwtPayload, sectorId: string) {
  const where = await getSectorAccessWhere(prisma, actor);
  if (!where) {
    return;
  }

  const sector = await prisma.sector.findFirst({
    where: { AND: [{ id: sectorId }, where] },
    select: { id: true },
  });

  if (!sector) {
    throw new ForbiddenException('You do not have permission for this sector');
  }
}

export async function assertServantAccess(prisma: Db, actor: JwtPayload, servantId: string) {
  const where = await getServantAccessWhere(prisma, actor);
  const servant = await prisma.servant.findFirst({
    where: where ? { AND: [{ id: servantId }, where] } : { id: servantId },
    select: { id: true },
  });

  if (!servant) {
    throw new ForbiddenException('You do not have permission for this servant');
  }
}

export async function hasPermissionOverride(
  prisma: Db,
  actor: JwtPayload,
  permissionKey: string,
): Promise<PermissionEffect | null> {
  const ctx = await loadActorScopeContext(prisma, actor);
  return ctx.overrides[permissionKey] ?? null;
}
