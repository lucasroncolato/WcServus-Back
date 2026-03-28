import { ForbiddenException } from '@nestjs/common';
import { PermissionEffect, Prisma, PrismaClient, Role, UserScope } from '@prisma/client';
import { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';

type Db = PrismaClient | { [K in keyof PrismaClient]: PrismaClient[K] };

type ActorScopeContext = {
  scopeType: UserScope;
  ministryIds: string[];
  teamIds: string[];
  servantId: string | null;
  overrides: Record<string, PermissionEffect>;
};

const NO_ACCESS_SERVANT: Prisma.ServantWhereInput = { id: '__no_access__' };
const NO_ACCESS_SCHEDULE: Prisma.ScheduleWhereInput = { id: '__no_access__' };
const NO_ACCESS_ATTENDANCE: Prisma.AttendanceWhereInput = { id: '__no_access__' };
const NO_ACCESS_PASTORAL: Prisma.PastoralVisitWhereInput = { id: '__no_access__' };
const NO_ACCESS_SECTOR: Prisma.MinistryWhereInput = { id: '__no_access__' };
const NO_ACCESS_TEAM: Prisma.TeamWhereInput = { id: '__no_access__' };
const MINISTRY_SCOPE = (UserScope as unknown as { MINISTRY?: UserScope }).MINISTRY ?? UserScope.MINISTRY;

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

function withChurchScope<T>(where: T | undefined, actor: JwtPayload): T | undefined {
  if (!actor.churchId) {
    return where;
  }
  const churchWhere = { churchId: actor.churchId } as T;
  return combineWhere(where, churchWhere);
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

export async function resolveCoordinatorSectorIds(prisma: Db, actor: JwtPayload) {
  if (actor.role !== Role.COORDENADOR) {
    return [] as string[];
  }

  const [coordinated, scoped] = await Promise.all([
    prisma.ministry.findMany({
      where: { coordinatorUserId: actor.sub },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: actor.sub },
      select: {
        scopeBindings: {
          select: { ministryId: true },
        },
      },
    }),
  ]);

  return unique([
    ...coordinated.map((item) => item.id),
    ...(scoped?.scopeBindings ?? [])
      .map((item) => item.ministryId)
      .filter((value): value is string => Boolean(value)),
  ]);
}

async function getRoleBaselineSectorIds(prisma: Db, actor: JwtPayload) {
  if (actor.role === Role.COORDENADOR) {
    return resolveCoordinatorSectorIds(prisma, actor);
  }
  return [] as string[];
}

async function loadActorScopeContext(prisma: Db, actor: JwtPayload): Promise<ActorScopeContext> {
  const user = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: {
      scope: true,
      servantId: true,
      scopeBindings: {
        select: {
          ministryId: true,
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

  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const fallbackScope =
    actor.role === Role.SERVO
      ? UserScope.SELF
      : actor.role === Role.COORDENADOR
        ? MINISTRY_SCOPE
        : UserScope.GLOBAL;

  if (!user) {
    return {
      scopeType: fallbackScope,
      ministryIds: roleSectorIds,
      teamIds: [],
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
        ? MINISTRY_SCOPE
        : user.scope ?? UserScope.GLOBAL;

  const ministryIds = unique([
    ...scopeBindings
      .map((binding) => binding.ministryId)
      .filter((value): value is string => Boolean(value)),
    ...roleSectorIds,
  ]);
  const teamIds = unique(
    scopeBindings
      .map((binding) => binding.teamId)
      .filter((value): value is string => Boolean(value)),
  );

  return {
    scopeType: enforcedScope,
    ministryIds,
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
    ministryIds: ctx.ministryIds,
    teamIds: ctx.teamIds,
    servantId: ctx.servantId,
  };
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

  if (actor.role === Role.COORDENADOR) {
    if (roleSectorIds.length === 0) {
      return NO_ACCESS_SERVANT;
    }

    return {
      OR: [
        { mainMinistryId: { in: roleSectorIds } },
        { servantMinistries: { some: { ministryId: { in: roleSectorIds } } } },
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

  if (actor.role === Role.COORDENADOR) {
    return roleSectorIds.length > 0 ? { ministryId: { in: roleSectorIds } } : NO_ACCESS_SCHEDULE;
  }

  return NO_ACCESS_SCHEDULE;
}

function getRoleBaselineSectorWhere(actor: JwtPayload, roleSectorIds: string[]): Prisma.MinistryWhereInput | undefined {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.COORDENADOR) {
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
): Prisma.TeamWhereInput | undefined {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN || actor.role === Role.PASTOR) {
    return undefined;
  }

  if (actor.role === Role.COORDENADOR) {
    return roleSectorIds.length > 0 ? { ministryId: { in: roleSectorIds } } : NO_ACCESS_TEAM;
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

  if (ctx.scopeType === MINISTRY_SCOPE) {
    if (ctx.ministryIds.length === 0) {
      return NO_ACCESS_SERVANT;
    }

    return {
      OR: [
        { mainMinistryId: { in: ctx.ministryIds } },
        { servantMinistries: { some: { ministryId: { in: ctx.ministryIds } } } },
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

  if (ctx.scopeType === MINISTRY_SCOPE) {
    return ctx.ministryIds.length > 0 ? { ministryId: { in: ctx.ministryIds } } : NO_ACCESS_SCHEDULE;
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

  if (ctx.scopeType === MINISTRY_SCOPE) {
    if (ctx.ministryIds.length === 0) {
      return NO_ACCESS_ATTENDANCE;
    }

    return {
      servant: {
        OR: [
          { mainMinistryId: { in: ctx.ministryIds } },
          { servantMinistries: { some: { ministryId: { in: ctx.ministryIds } } } },
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

  if (ctx.scopeType === MINISTRY_SCOPE) {
    if (ctx.ministryIds.length === 0) {
      return NO_ACCESS_PASTORAL;
    }

    return {
      servant: {
        OR: [
          { mainMinistryId: { in: ctx.ministryIds } },
          { servantMinistries: { some: { ministryId: { in: ctx.ministryIds } } } },
        ],
      },
    };
  }

  if (ctx.scopeType === UserScope.EQUIPE) {
    return ctx.teamIds.length > 0 ? { servant: { teamId: { in: ctx.teamIds } } } : NO_ACCESS_PASTORAL;
  }

  return NO_ACCESS_PASTORAL;
}

function getScopeSectorWhere(ctx: ActorScopeContext): Prisma.MinistryWhereInput | undefined {
  if (ctx.scopeType === UserScope.GLOBAL) {
    return undefined;
  }

  if (ctx.scopeType === UserScope.SELF) {
    return NO_ACCESS_SECTOR;
  }

  if (ctx.scopeType === MINISTRY_SCOPE || ctx.scopeType === UserScope.EQUIPE) {
    return ctx.ministryIds.length > 0 ? { id: { in: ctx.ministryIds } } : NO_ACCESS_SECTOR;
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

  if (ctx.scopeType === MINISTRY_SCOPE) {
    return ctx.ministryIds.length > 0 ? { ministryId: { in: ctx.ministryIds } } : NO_ACCESS_TEAM;
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
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);

  const roleBaseline = getRoleBaselineSectorWhere(actor, roleSectorIds);
  const scopeBaseline = getScopeSectorWhere(ctx);
  const where = combineWhere(roleBaseline, scopeBaseline);

  if (!where) {
    const ministries = await prisma.ministry.findMany({ select: { id: true } });
    return ministries.map((ministry) => ministry.id);
  }

  const ministries = await prisma.ministry.findMany({
    where,
    select: { id: true },
  });
  return ministries.map((ministry) => ministry.id);
}

export async function resolveScopedMinistryIds(prisma: Db, actor: JwtPayload) {
  return resolveScopedSectorIds(prisma, actor);
}

export async function getServantAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.ServantWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return withChurchScope(
    combineWhere(getRoleBaselineServantWhere(actor, roleSectorIds), getScopeServantWhere(ctx)),
    actor,
  );
}

export async function getScheduleAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.ScheduleWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return withChurchScope(
    combineWhere(getRoleBaselineScheduleWhere(actor, roleSectorIds), getScopeScheduleWhere(ctx)),
    actor,
  );
}

export async function getAttendanceAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.AttendanceWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return withChurchScope(
    combineWhere(
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
                  { mainMinistryId: { in: roleSectorIds } },
                  { servantMinistries: { some: { ministryId: { in: roleSectorIds } } } },
                ],
              },
            }
          : NO_ACCESS_ATTENDANCE,
    getScopeAttendanceWhere(ctx),
    ),
    actor,
  );
}

export async function getPastoralVisitAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.PastoralVisitWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return withChurchScope(
    combineWhere(
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
                  { mainMinistryId: { in: roleSectorIds } },
                  { servantMinistries: { some: { ministryId: { in: roleSectorIds } } } },
                ],
              },
            }
          : NO_ACCESS_PASTORAL,
    getScopePastoralWhere(ctx),
    ),
    actor,
  );
}

export async function getMinistryAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.MinistryWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return withChurchScope(
    combineWhere(getRoleBaselineSectorWhere(actor, roleSectorIds), getScopeSectorWhere(ctx)),
    actor,
  );
}

export async function getTeamAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.TeamWhereInput | undefined> {
  const roleSectorIds = await getRoleBaselineSectorIds(prisma, actor);
  const ctx = await loadActorScopeContext(prisma, actor);
  return withChurchScope(
    combineWhere(getRoleBaselineTeamWhere(actor, roleSectorIds), getScopeTeamWhere(ctx)),
    actor,
  );
}

export async function getUserAccessWhere(
  prisma: Db,
  actor: JwtPayload,
): Promise<Prisma.UserWhereInput | undefined> {
  const ctx = await loadActorScopeContext(prisma, actor);
  return withChurchScope(getScopeUserWhere(ctx, actor), actor);
}

export async function assertMinistryAccess(prisma: Db, actor: JwtPayload, ministryId: string) {
  const where = await getMinistryAccessWhere(prisma, actor);
  if (!where) {
    return;
  }

  const ministry = await prisma.ministry.findFirst({
    where: { AND: [{ id: ministryId }, where] },
    select: { id: true },
  });

  if (!ministry) {
    throw new ForbiddenException('You do not have permission for this ministry');
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




