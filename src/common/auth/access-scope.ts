import { ForbiddenException } from '@nestjs/common';
import { PermissionEffect, Prisma, PrismaClient, Role, UserScope } from '@prisma/client';
import { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';

type Db = PrismaClient | { [K in keyof PrismaClient]: PrismaClient[K] };

type ActorScopeContext = {
  scopeType: UserScope;
  sectorIds: string[];
  teamIds: string[];
  servantId: string | null;
  overrides: Record<string, PermissionEffect>;
};

const NO_ACCESS_SERVANT: Prisma.ServantWhereInput = { id: '__no_access__' };
const NO_ACCESS_SCHEDULE: Prisma.ScheduleWhereInput = { id: '__no_access__' };
const NO_ACCESS_ATTENDANCE: Prisma.AttendanceWhereInput = { id: '__no_access__' };
const NO_ACCESS_PASTORAL: Prisma.PastoralVisitWhereInput = { id: '__no_access__' };
const NO_ACCESS_SECTOR: Prisma.SectorWhereInput = { id: '__no_access__' };
const NO_ACCESS_TEAM: Prisma.TeamWhereInput = { id: '__no_access__' };

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
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

export async function resolveServantSelfScope(prisma: Db, actor: JwtPayload) {
  if (actor.servantId) {
    return actor.servantId;
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: { servantId: true },
  });

  return user?.servantId ?? null;
}

export async function resolveLeaderTeamIds(prisma: Db, actor: JwtPayload) {
  if (actor.role !== Role.LIDER) {
    return [] as string[];
  }

  const [ledTeams, userBindings, userServant] = await Promise.all([
    prisma.team.findMany({
      where: { leaderUserId: actor.sub },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: actor.sub },
      select: {
        scopeBindings: {
          select: { teamId: true },
        },
      },
    }),
    resolveServantSelfScope(prisma, actor).then(async (servantId) => {
      if (!servantId) {
        return null;
      }
      return prisma.servant.findUnique({
        where: { id: servantId },
        select: { teamId: true },
      });
    }),
  ]);

  return unique([
    ...ledTeams.map((team) => team.id),
    ...(userBindings?.scopeBindings ?? [])
      .map((binding) => binding.teamId)
      .filter((value): value is string => Boolean(value)),
    ...(userServant?.teamId ? [userServant.teamId] : []),
  ]);
}

export async function resolveCoordinatorSectorIds(prisma: Db, actor: JwtPayload) {
  if (actor.role !== Role.COORDENADOR) {
    return [] as string[];
  }

  const [coordinated, scoped] = await Promise.all([
    prisma.sector.findMany({
      where: { coordinatorUserId: actor.sub },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: actor.sub },
      select: {
        scopeBindings: {
          select: { sectorId: true },
        },
      },
    }),
  ]);

  return unique([
    ...coordinated.map((item) => item.id),
    ...(scoped?.scopeBindings ?? [])
      .map((item) => item.sectorId)
      .filter((value): value is string => Boolean(value)),
  ]);
}

async function getRoleBaselineSectorIds(prisma: Db, actor: JwtPayload, roleTeamIds: string[]) {
  if (actor.role === Role.COORDENADOR) {
    return resolveCoordinatorSectorIds(prisma, actor);
  }

  if (actor.role === Role.LIDER) {
    if (roleTeamIds.length > 0) {
      const teams = await prisma.team.findMany({
        where: { id: { in: roleTeamIds } },
        select: { sectorId: true },
      });
      if (teams.length > 0) {
        return unique(teams.map((team) => team.sectorId));
      }
    }

    const servantId = await resolveServantSelfScope(prisma, actor);
    if (!servantId) {
      return [];
    }

    const actorServant = await prisma.servant.findUnique({
      where: { id: servantId },
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
          teamId: true,
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

  const roleTeamIds = actor.role === Role.LIDER ? await resolveLeaderTeamIds(prisma, actor) : [];
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor, roleTeamIds);
  const fallbackScope =
    actor.role === Role.SERVO
      ? UserScope.SELF
      : actor.role === Role.COORDENADOR
        ? UserScope.SETOR
        : actor.role === Role.LIDER
          ? UserScope.EQUIPE
          : UserScope.GLOBAL;

  if (!user) {
    return {
      scopeType: fallbackScope,
      sectorIds: roleSectorIds,
      teamIds: roleTeamIds,
      servantId: actor.servantId ?? null,
      overrides: {},
    };
  }

  const scopeBindings = user.scopeBindings ?? [];
  const permissionOverrides = user.permissionOverrides ?? [];
  const enforcedScope =
    actor.role === Role.SERVO
      ? UserScope.SELF
      : actor.role === Role.COORDENADOR
        ? UserScope.SETOR
        : actor.role === Role.LIDER
          ? UserScope.EQUIPE
          : user.scope ?? UserScope.GLOBAL;

  const sectorIds = unique([
    ...scopeBindings
      .map((binding) => binding.sectorId)
      .filter((value): value is string => Boolean(value)),
    ...roleSectorIds,
  ]);
  const teamIds = unique([
    ...scopeBindings
      .map((binding) => binding.teamId)
      .filter((value): value is string => Boolean(value)),
    ...roleTeamIds,
  ]);

  return {
    scopeType: enforcedScope,
    sectorIds,
    teamIds,
    servantId: user.servantId ?? actor.servantId ?? null,
    overrides: Object.fromEntries(permissionOverrides.map((item) => [item.permissionKey, item.effect])),
  };
}

export async function getCurrentUserScope(prisma: Db, actor: JwtPayload) {
  const ctx = await loadActorScopeContext(prisma, actor);
  return {
    role: actor.role,
    scopeType: ctx.scopeType,
    sectorIds: ctx.sectorIds,
    teamIds: ctx.teamIds,
    servantId: ctx.servantId,
  };
}

function getRoleBaselineServantWhere(
  actor: JwtPayload,
  roleSectorIds: string[],
  roleTeamIds: string[],
): Prisma.ServantWhereInput | undefined {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.SERVO) {
    return actor.servantId ? { id: actor.servantId } : NO_ACCESS_SERVANT;
  }

  if (actor.role === Role.COORDENADOR) {
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

  if (actor.role === Role.LIDER) {
    return roleTeamIds.length > 0 ? { teamId: { in: roleTeamIds } } : NO_ACCESS_SERVANT;
  }

  return NO_ACCESS_SERVANT;
}

function getRoleBaselineScheduleWhere(
  actor: JwtPayload,
  roleSectorIds: string[],
  roleTeamIds: string[],
): Prisma.ScheduleWhereInput | undefined {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.SERVO) {
    return actor.servantId ? { servantId: actor.servantId } : NO_ACCESS_SCHEDULE;
  }

  if (actor.role === Role.COORDENADOR) {
    return roleSectorIds.length > 0 ? { sectorId: { in: roleSectorIds } } : NO_ACCESS_SCHEDULE;
  }

  if (actor.role === Role.LIDER) {
    return roleTeamIds.length > 0 ? { servant: { teamId: { in: roleTeamIds } } } : NO_ACCESS_SCHEDULE;
  }

  return NO_ACCESS_SCHEDULE;
}

function getRoleBaselineSectorWhere(actor: JwtPayload, roleSectorIds: string[]): Prisma.SectorWhereInput | undefined {
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

function getRoleBaselineTeamWhere(
  actor: JwtPayload,
  roleSectorIds: string[],
  roleTeamIds: string[],
): Prisma.TeamWhereInput | undefined {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.COORDENADOR) {
    return roleSectorIds.length > 0 ? { sectorId: { in: roleSectorIds } } : NO_ACCESS_TEAM;
  }

  if (actor.role === Role.LIDER) {
    return roleTeamIds.length > 0 ? { id: { in: roleTeamIds } } : NO_ACCESS_TEAM;
  }

  return NO_ACCESS_TEAM;
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
    return ctx.teamIds.length > 0 ? { teamId: { in: ctx.teamIds } } : NO_ACCESS_SERVANT;
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
    return ctx.teamIds.length > 0 ? { servant: { teamId: { in: ctx.teamIds } } } : NO_ACCESS_SCHEDULE;
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
    return ctx.teamIds.length > 0 ? { servant: { teamId: { in: ctx.teamIds } } } : NO_ACCESS_ATTENDANCE;
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
    return ctx.teamIds.length > 0 ? { servant: { teamId: { in: ctx.teamIds } } } : NO_ACCESS_PASTORAL;
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

function getScopeTeamWhere(ctx: ActorScopeContext): Prisma.TeamWhereInput | undefined {
  if (ctx.scopeType === UserScope.GLOBAL) {
    return undefined;
  }

  if (ctx.scopeType === UserScope.SELF) {
    return NO_ACCESS_TEAM;
  }

  if (ctx.scopeType === UserScope.SETOR) {
    return ctx.sectorIds.length > 0 ? { sectorId: { in: ctx.sectorIds } } : NO_ACCESS_TEAM;
  }

  if (ctx.scopeType === UserScope.EQUIPE) {
    return ctx.teamIds.length > 0 ? { id: { in: ctx.teamIds } } : NO_ACCESS_TEAM;
  }

  return NO_ACCESS_TEAM;
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
  const roleTeamIds = actor.role === Role.LIDER ? await resolveLeaderTeamIds(prisma, actor) : [];
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor, roleTeamIds);
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
  const roleTeamIds = actor.role === Role.LIDER ? await resolveLeaderTeamIds(prisma, actor) : [];
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor, roleTeamIds);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    getRoleBaselineServantWhere(actor, roleSectorIds, roleTeamIds),
    getScopeServantWhere(ctx),
  );
}

export async function getScheduleAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.ScheduleWhereInput | undefined> {
  const roleTeamIds = actor.role === Role.LIDER ? await resolveLeaderTeamIds(prisma, actor) : [];
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor, roleTeamIds);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    getRoleBaselineScheduleWhere(actor, roleSectorIds, roleTeamIds),
    getScopeScheduleWhere(ctx),
  );
}

export async function getAttendanceAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.AttendanceWhereInput | undefined> {
  const roleTeamIds = actor.role === Role.LIDER ? await resolveLeaderTeamIds(prisma, actor) : [];
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor, roleTeamIds);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR
      ? undefined
      : actor.role === Role.SERVO
        ? actor.servantId
          ? { servantId: actor.servantId }
          : NO_ACCESS_ATTENDANCE
        : actor.role === Role.LIDER
          ? roleTeamIds.length > 0
            ? { servant: { teamId: { in: roleTeamIds } } }
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
  const roleTeamIds = actor.role === Role.LIDER ? await resolveLeaderTeamIds(prisma, actor) : [];
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor, roleTeamIds);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR
      ? undefined
      : actor.role === Role.SERVO
        ? actor.servantId
          ? { servantId: actor.servantId }
          : NO_ACCESS_PASTORAL
        : actor.role === Role.LIDER
          ? roleTeamIds.length > 0
            ? { servant: { teamId: { in: roleTeamIds } } }
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
  const roleTeamIds = actor.role === Role.LIDER ? await resolveLeaderTeamIds(prisma, actor) : [];
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor, roleTeamIds);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    getRoleBaselineSectorWhere(actor, roleSectorIds),
    getScopeSectorWhere(ctx),
  );
}

export async function getTeamAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.TeamWhereInput | undefined> {
  const roleTeamIds = actor.role === Role.LIDER ? await resolveLeaderTeamIds(prisma, actor) : [];
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor, roleTeamIds);
  const ctx = await loadActorScopeContext(prisma, actor);
  return combineWhere(
    getRoleBaselineTeamWhere(actor, roleSectorIds, roleTeamIds),
    getScopeTeamWhere(ctx),
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

export async function assertTeamAccess(prisma: Db, actor: JwtPayload, teamId: string) {
  const where = await getTeamAccessWhere(prisma, actor);
  const team = await prisma.team.findFirst({
    where: where ? { AND: [{ id: teamId }, where] } : { id: teamId },
    select: { id: true },
  });

  if (!team) {
    throw new ForbiddenException('You do not have permission for this team');
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
