import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AchievementType, AuditAction, GamificationActionType, Prisma, Role } from '@prisma/client';
import { assertMinistryAccess } from 'src/common/auth/access-scope';
import { EventBusService } from 'src/common/events/event-bus.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: EventBusService,
  ) {}

  async syncDefaultAchievementsCatalog(actorUserId?: string, churchId?: string | null) {
    const catalog = this.defaultAchievementCatalog();
    const scopeChurchId = churchId ?? null;
    for (const item of catalog) {
      const existing = await this.prisma.achievement.findFirst({
        where: {
          code: item.code,
          churchId: scopeChurchId,
        },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.achievement.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            description: item.description,
            type: item.type,
            icon: item.icon,
            category: item.category,
            pointsBonus: item.pointsBonus,
            criteria: item.criteria as Prisma.InputJsonValue,
            active: true,
          },
        });
      } else {
        await this.prisma.achievement.create({
          data: {
            churchId: scopeChurchId,
            code: item.code,
            name: item.name,
            description: item.description,
            type: item.type,
            icon: item.icon,
            category: item.category,
            pointsBonus: item.pointsBonus,
            criteria: item.criteria as Prisma.InputJsonValue,
            active: true,
            createdBy: actorUserId ?? null,
          },
        });
      }
    }
    return { synchronized: catalog.length, churchId: scopeChurchId };
  }

  async awardPoints(input: {
    servantId: string;
    churchId?: string | null;
    ministryId?: string | null;
    actionType: GamificationActionType;
    referenceId?: string;
    metadata?: Record<string, unknown>;
    actorUserId?: string;
  }) {
    const servant = await this.prisma.servant.findFirst({
      where: { id: input.servantId, deletedAt: null },
      select: { id: true, churchId: true, mainMinistryId: true },
    });
    if (!servant) throw new NotFoundException('Servant not found');

    const churchId = input.churchId ?? servant.churchId ?? null;
    const ministryId = input.ministryId ?? servant.mainMinistryId ?? null;

    if (input.referenceId) {
      const exists = await this.prisma.servantPointLog.findFirst({
        where: { servantId: input.servantId, actionType: input.actionType, referenceId: input.referenceId },
        select: { id: true },
      });
      if (exists) {
        return this.getServantProgress(input.servantId, churchId ?? undefined);
      }
    }

    const rule = await this.prisma.pointRule.findFirst({
      where: {
        actionType: input.actionType,
        active: true,
        OR: [{ churchId }, { churchId: null }],
      },
      orderBy: [{ churchId: 'desc' }],
      select: { points: true },
    });

    if (!rule) {
      return this.getServantProgress(input.servantId, churchId ?? undefined);
    }

    await this.prisma.servantPointLog.create({
      data: {
        churchId,
        servantId: input.servantId,
        ministryId,
        actionType: input.actionType,
        points: rule.points,
        referenceId: input.referenceId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    const beforeProfile = await this.prisma.servantGamificationProfile.findUnique({
      where: { servantId: input.servantId },
      select: { totalPoints: true, currentLevel: true, currentLevelOrder: true },
    });
    const progress = await this.recomputeServantProfile(input.servantId, churchId ?? undefined);
    await this.evaluateAchievements(input.servantId, churchId ?? undefined, input.actorUserId);

    await this.auditService.log({
      action: AuditAction.GAMIFICATION_POINTS_GRANTED,
      entity: 'ServantPointLog',
      entityId: input.referenceId ?? `${input.servantId}:${input.actionType}:${Date.now()}`,
      userId: input.actorUserId,
      metadata: {
        servantId: input.servantId,
        actionType: input.actionType,
        points: rule.points,
        referenceId: input.referenceId,
      },
    });

    await this.eventBus.emit({
      name: 'GAMIFICATION_POINTS_GRANTED',
      occurredAt: new Date(),
      actorUserId: input.actorUserId,
      churchId,
      payload: {
        servantId: input.servantId,
        actionType: input.actionType,
        referenceId: input.referenceId ?? null,
      },
    });
    if (
      beforeProfile?.currentLevelOrder !== progress.currentLevelOrder ||
      beforeProfile?.currentLevel !== progress.currentLevel
    ) {
      await this.auditService.log({
        action: AuditAction.GAMIFICATION_LEVEL_UPDATED,
        entity: 'ServantGamificationProfile',
        entityId: input.servantId,
        userId: input.actorUserId,
        metadata: {
          servantId: input.servantId,
          fromLevel: beforeProfile?.currentLevel ?? null,
          toLevel: progress.currentLevel ?? null,
          fromLevelOrder: beforeProfile?.currentLevelOrder ?? 0,
          toLevelOrder: progress.currentLevelOrder,
        },
      });
      await this.eventBus.emit({
        name: 'GAMIFICATION_LEVEL_UPDATED',
        occurredAt: new Date(),
        actorUserId: input.actorUserId,
        churchId,
        payload: {
          servantId: input.servantId,
          fromLevel: beforeProfile?.currentLevel ?? null,
          toLevel: progress.currentLevel ?? null,
          fromLevelOrder: beforeProfile?.currentLevelOrder ?? 0,
          toLevelOrder: progress.currentLevelOrder,
        },
      });
    }

    return progress;
  }

  async recomputeServantProfile(servantId: string, churchId?: string) {
    const [totalPoints, achievementsUnlocked, attendance, tasks] = await Promise.all([
      this.prisma.servantPointLog.aggregate({
        where: { servantId, ...(churchId ? { churchId } : {}) },
        _sum: { points: true },
      }),
      this.prisma.servantAchievement.count({
        where: { servantId, ...(churchId ? { churchId } : {}) },
      }),
      this.prisma.attendance.aggregate({
        where: { servantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.ministryTaskOccurrence.aggregate({
        where: { assignedServantId: servantId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const points = Number(totalPoints._sum.points ?? 0);
    const levels = await this.prisma.servantLevelDefinition.findMany({
      where: { active: true, OR: [{ churchId: churchId ?? null }, { churchId: null }] },
      orderBy: [{ threshold: 'asc' }, { levelOrder: 'asc' }],
    });
    const currentLevel = levels.filter((item) => points >= item.threshold).at(-1) ?? null;

    const profile = await this.prisma.servantGamificationProfile.upsert({
      where: { servantId },
      update: {
        churchId: churchId ?? null,
        totalPoints: points,
        currentLevel: currentLevel?.name ?? null,
        currentLevelOrder: currentLevel?.levelOrder ?? 0,
        achievementsUnlocked,
        attendanceRate: attendance._count._all ? 100 : 0,
        completionRate: tasks._count._all ? 100 : 0,
        rankingScore: points + achievementsUnlocked * 10,
      },
      create: {
        servantId,
        churchId: churchId ?? null,
        totalPoints: points,
        currentLevel: currentLevel?.name ?? null,
        currentLevelOrder: currentLevel?.levelOrder ?? 0,
        achievementsUnlocked,
        attendanceRate: attendance._count._all ? 100 : 0,
        completionRate: tasks._count._all ? 100 : 0,
        rankingScore: points + achievementsUnlocked * 10,
      },
    });

    return profile;
  }

  async getServantProgress(servantId: string, churchId?: string) {
    const [profile, recentPoints, achievements] = await Promise.all([
      this.prisma.servantGamificationProfile.findUnique({ where: { servantId } }),
      this.prisma.servantPointLog.findMany({
        where: { servantId, ...(churchId ? { churchId } : {}) },
        orderBy: [{ createdAt: 'desc' }],
        take: 30,
      }),
      this.prisma.servantAchievement.findMany({
        where: { servantId, ...(churchId ? { churchId } : {}) },
        include: { achievement: true },
        orderBy: [{ unlockedAt: 'desc' }],
        take: 30,
      }),
    ]);

    const points = profile?.totalPoints ?? 0;
    const rank = await this.prisma.servantGamificationProfile.count({
      where: {
        ...(churchId ? { churchId } : {}),
        totalPoints: { gt: points },
      },
    });

    return {
      profile,
      rankingPosition: rank + 1,
      recentPoints,
      achievements,
    };
  }

  async ranking(query: { churchId?: string; ministryId?: string; limit?: number }, actor: JwtPayload) {
    if (query.ministryId && actor.role === Role.COORDENADOR) {
      await assertMinistryAccess(this.prisma, actor, query.ministryId);
    }

    const limit = Math.max(1, Math.min(200, query.limit ?? 20));
    const where: Prisma.ServantGamificationProfileWhereInput = {
      ...(query.churchId ? { churchId: query.churchId } : actor.churchId ? { churchId: actor.churchId } : {}),
      ...(query.ministryId
        ? {
            servant: {
              OR: [
                { mainMinistryId: query.ministryId },
                { servantMinistries: { some: { ministryId: query.ministryId } } },
              ],
            },
          }
        : {}),
    };

    const rows = await this.prisma.servantGamificationProfile.findMany({
      where,
      include: { servant: { select: { id: true, name: true, mainMinistryId: true } } },
      orderBy: [{ totalPoints: 'desc' }, { achievementsUnlocked: 'desc' }, { updatedAt: 'asc' }],
      take: limit,
    });

    return rows.map((item, index) => ({
      position: index + 1,
      servantId: item.servantId,
      servantName: item.servant.name,
      points: item.totalPoints,
      level: item.currentLevel,
      achievements: item.achievementsUnlocked,
      rankingScore: item.rankingScore,
    }));
  }

  async dashboard(actor: JwtPayload, query?: { ministryId?: string }) {
    const churchId = actor.churchId ?? undefined;
    const ministryId = query?.ministryId;
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (actor.role === Role.SERVO) {
      const servantId =
        actor.servantId ??
        (await this.prisma.user.findUnique({
          where: { id: actor.sub },
          select: { servantId: true },
        }))?.servantId;
      if (!servantId) throw new ForbiddenException('User is not linked to a servant');
      const [progress, myPendingTasks, myOverdueTasks] = await Promise.all([
        this.getServantProgress(servantId, churchId),
        this.prisma.ministryTaskOccurrence.count({
          where: {
            deletedAt: null,
            status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] },
            OR: [
              { assignedServantId: servantId },
              { assignees: { some: { servantId, active: true } } },
            ],
          },
        }),
        this.prisma.ministryTaskOccurrence.count({
          where: {
            deletedAt: null,
            status: 'OVERDUE',
            OR: [
              { assignedServantId: servantId },
              { assignees: { some: { servantId, active: true } } },
            ],
          },
        }),
      ]);
      return {
        mode: 'SERVO',
        progress,
        myPendingTasks,
        myOverdueTasks,
      };
    }

    if (actor.role === Role.COORDENADOR && ministryId) {
      await assertMinistryAccess(this.prisma, actor, ministryId);
    }

    const servantMinistryFilter = ministryId
      ? {
          OR: [
            { mainMinistryId: ministryId },
            { servantMinistries: { some: { ministryId } } },
          ],
        }
      : {};

    const [activeServants, pointsGenerated, overdueTasks, completedTasks, unassignedTasks, topRanking] =
      await Promise.all([
        this.prisma.servant.count({
          where: {
            deletedAt: null,
            status: 'ATIVO',
            ...(churchId ? { churchId } : {}),
            ...servantMinistryFilter,
          },
        }),
        this.prisma.servantPointLog.aggregate({
          where: {
            ...(churchId ? { churchId } : {}),
            ...(ministryId ? { ministryId } : {}),
            createdAt: { gte: last30Days },
          },
          _sum: { points: true },
        }),
        this.prisma.ministryTaskOccurrence.count({
          where: {
            deletedAt: null,
            ...(churchId ? { churchId } : {}),
            ...(ministryId ? { ministryId } : {}),
            status: 'OVERDUE',
          },
        }),
        this.prisma.ministryTaskOccurrence.count({
          where: {
            deletedAt: null,
            ...(churchId ? { churchId } : {}),
            ...(ministryId ? { ministryId } : {}),
            status: 'COMPLETED',
            completedAt: { gte: last30Days },
          },
        }),
        this.prisma.ministryTaskOccurrence.count({
          where: {
            deletedAt: null,
            ...(churchId ? { churchId } : {}),
            ...(ministryId ? { ministryId } : {}),
            assignedServantId: null,
            status: { notIn: ['CANCELLED', 'COMPLETED'] },
          },
        }),
        this.ranking({ churchId, ministryId, limit: 10 }, actor),
      ]);

    return {
      mode: 'LEADERSHIP',
      activeServants,
      pointsGeneratedLast30Days: Number(pointsGenerated._sum.points ?? 0),
      overdueTasks,
      completedTasksLast30Days: completedTasks,
      unassignedTasks,
      topRanking,
    };
  }

  async dashboardAdmin(actor: JwtPayload, query?: { startDate?: string; endDate?: string; ministryId?: string }) {
    const analytics = await this.analyticsChurch(actor, query);
    const [ranking, rankingMonthly, tasksRanking, attendanceRanking] = await Promise.all([
      this.ranking({ churchId: actor.churchId ?? undefined, ministryId: query?.ministryId, limit: 10 }, actor),
      this.rankingMonthly({ ministryId: query?.ministryId, limit: 10 }, actor),
      this.rankingByMetric('tasks', { ministryId: query?.ministryId, limit: 10 }, actor),
      this.rankingByMetric('attendance', { ministryId: query?.ministryId, limit: 10 }, actor),
    ]);
    return {
      profile: 'ADMIN',
      analytics,
      ranking,
      rankingMonthly,
      tasksRanking,
      attendanceRanking,
      criticalAlerts: [
        ...(Number((analytics as any).tasksOverdue ?? 0) > 0 ? ['Existem tarefas atrasadas'] : []),
        ...(Number((analytics as any).absenceRate ?? 0) >= 25 ? ['Taxa de faltas acima de 25%'] : []),
      ],
    };
  }

  async dashboardPastor(actor: JwtPayload, query?: { startDate?: string; endDate?: string; ministryId?: string }) {
    const analytics = await this.analyticsChurch(actor, query);
    const leadersInTraining = await this.prisma.servant.count({
      where: {
        deletedAt: null,
        ...(actor.churchId ? { churchId: actor.churchId } : {}),
        trainingStatus: 'PENDING',
        status: 'ATIVO',
      },
    });
    const ministryHealth = await this.prisma.ministryTaskOccurrence.groupBy({
      by: ['ministryId'],
      where: { deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      _count: { _all: true },
    });
    return {
      profile: 'PASTOR',
      analytics,
      leadersInTraining,
      ministryHealth,
      strategicAlerts: [
        ...(Number((analytics as any).absenceRate ?? 0) >= 20 ? ['Presenca ministerial em atencao'] : []),
        ...(Number((analytics as any).growthTracksCompleted ?? 0) === 0 ? ['Nenhuma trilha concluida no periodo'] : []),
      ],
    };
  }

  async dashboardCoordinator(actor: JwtPayload, query?: { startDate?: string; endDate?: string; ministryId?: string }) {
    const scopedMinistryId =
      query?.ministryId ??
      (await this.prisma.userMinistryBinding.findFirst({
        where: { userId: actor.sub, ministryId: { not: null } },
        select: { ministryId: true },
      }))?.ministryId ??
      undefined;
    if (!scopedMinistryId) throw new ForbiddenException('Coordinator ministry scope not found');
    await assertMinistryAccess(this.prisma, actor, scopedMinistryId);
    const analytics = await this.analyticsMinistry(actor, scopedMinistryId, query);
    const [ranking, tasks, attendance] = await Promise.all([
      this.ranking({ churchId: actor.churchId ?? undefined, ministryId: scopedMinistryId, limit: 10 }, actor),
      this.rankingByMetric('tasks', { ministryId: scopedMinistryId, limit: 10 }, actor),
      this.rankingByMetric('attendance', { ministryId: scopedMinistryId, limit: 10 }, actor),
    ]);
    return {
      profile: 'COORDENADOR',
      ministryId: scopedMinistryId,
      analytics,
      ranking,
      tasks,
      attendance,
    };
  }

  async dashboardServo(actor: JwtPayload, query?: { startDate?: string; endDate?: string }) {
    const servantId =
      actor.servantId ??
      (await this.prisma.user.findUnique({ where: { id: actor.sub }, select: { servantId: true } }))?.servantId;
    if (!servantId) throw new ForbiddenException('User is not linked to a servant');
    const [analytics, progress, tracks, achievements] = await Promise.all([
      this.analyticsServant(actor, servantId, query),
      this.getServantProgress(servantId, actor.churchId ?? undefined),
      this.myGrowthTracks({ ...actor, servantId }),
      this.listAchievementsCatalog(actor, servantId),
    ]);
    return {
      profile: 'SERVO',
      analytics,
      progress,
      tracks,
      achievements,
      nextSteps: tracks
        .map((track: any) => ({
          trackId: track.id,
          trackName: track.name,
          nextStep: track.steps.find((step: any) => !step.progress?.completed)?.title ?? null,
        }))
        .filter((item: any) => item.nextStep),
    };
  }

  async rankingMonthly(
    query: { ministryId?: string; limit?: number; month?: number; year?: number },
    actor: JwtPayload,
  ) {
    const year = query.year ?? new Date().getUTCFullYear();
    const month = query.month ?? new Date().getUTCMonth() + 1;
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    return this.rankingByMetric('points', { ...query, startDate: start, endDate: end }, actor);
  }

  async rankingYearly(
    query: { ministryId?: string; limit?: number; year?: number },
    actor: JwtPayload,
  ) {
    const year = query.year ?? new Date().getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    return this.rankingByMetric('points', { ...query, startDate: start, endDate: end }, actor);
  }

  async rankingByMetric(
    metric: 'points' | 'tasks' | 'attendance' | 'checklist' | 'growth',
    query: {
      ministryId?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      month?: number;
      year?: number;
    },
    actor: JwtPayload,
  ) {
    const limit = Math.max(1, Math.min(200, query.limit ?? 20));
    const churchId = actor.churchId ?? undefined;
    if (query.ministryId && actor.role === Role.COORDENADOR) {
      await assertMinistryAccess(this.prisma, actor, query.ministryId);
    }
    const period = this.resolveDateRange(query.startDate, query.endDate, query.month, query.year);

    let grouped: Array<{ servantId: string; value: number }> = [];
    if (metric === 'points') {
      const rows = await this.prisma.servantPointLog.groupBy({
        by: ['servantId'],
        where: {
          ...(churchId ? { churchId } : {}),
          ...(query.ministryId ? { ministryId: query.ministryId } : {}),
          createdAt: period,
        },
        _sum: { points: true },
      });
      grouped = rows.map((item) => ({ servantId: item.servantId, value: Number(item._sum.points ?? 0) }));
    } else if (metric === 'tasks') {
      const rows = await this.prisma.ministryTaskOccurrence.groupBy({
        by: ['assignedServantId'],
        where: {
          deletedAt: null,
          assignedServantId: { not: null },
          status: 'COMPLETED',
          ...(churchId ? { churchId } : {}),
          ...(query.ministryId ? { ministryId: query.ministryId } : {}),
          completedAt: period,
        },
        _count: { _all: true },
      });
      grouped = rows
        .filter((item) => Boolean(item.assignedServantId))
        .map((item) => ({ servantId: item.assignedServantId as string, value: item._count._all }));
    } else if (metric === 'attendance') {
      const rows = await this.prisma.attendance.groupBy({
        by: ['servantId'],
        where: {
          deletedAt: null,
          status: 'PRESENTE',
          ...(churchId ? { churchId } : {}),
          createdAt: period,
          ...(query.ministryId
            ? {
                servant: {
                  OR: [
                    { mainMinistryId: query.ministryId },
                    { servantMinistries: { some: { ministryId: query.ministryId } } },
                  ],
                },
              }
            : {}),
        },
        _count: { _all: true },
      });
      grouped = rows.map((item) => ({ servantId: item.servantId, value: item._count._all }));
    } else if (metric === 'checklist') {
      const rows = await this.prisma.servantPointLog.groupBy({
        by: ['servantId'],
        where: {
          ...(churchId ? { churchId } : {}),
          ...(query.ministryId ? { ministryId: query.ministryId } : {}),
          actionType: 'CHECKLIST_PERFECT',
          createdAt: period,
        },
        _count: { _all: true },
      });
      grouped = rows.map((item) => ({ servantId: item.servantId, value: item._count._all }));
    } else {
      const rows = await this.prisma.servantGrowthProgress.groupBy({
        by: ['servantId'],
        where: {
          completed: true,
          ...(churchId ? { churchId } : {}),
          ...(query.ministryId
            ? {
                servant: {
                  OR: [
                    { mainMinistryId: query.ministryId },
                    { servantMinistries: { some: { ministryId: query.ministryId } } },
                  ],
                },
              }
            : {}),
          completedAt: period,
        },
        _count: { _all: true },
      });
      grouped = rows.map((item) => ({ servantId: item.servantId, value: item._count._all }));
    }

    const sorted = grouped.sort((a, b) => b.value - a.value || a.servantId.localeCompare(b.servantId));
    const top = sorted.slice(0, limit);
    const servantIds = [...new Set(top.map((item) => item.servantId))];
    const servants = await this.prisma.servant.findMany({
      where: { id: { in: servantIds } },
      select: { id: true, name: true },
    });
    const nameByServantId = new Map(servants.map((item) => [item.id, item.name]));
    const actorServantId =
      actor.servantId ??
      (await this.prisma.user.findUnique({ where: { id: actor.sub }, select: { servantId: true } }))?.servantId ??
      null;
    const myIndex = actorServantId ? sorted.findIndex((item) => item.servantId === actorServantId) : -1;

    return {
      metric,
      period: { startDate: period.gte, endDate: period.lte },
      totalRanked: sorted.length,
      myPosition:
        myIndex >= 0
          ? {
              position: myIndex + 1,
              servantId: actorServantId,
              servantName: nameByServantId.get(actorServantId ?? '') ?? null,
              value: sorted[myIndex].value,
            }
          : null,
      data: top.map((item, index) => ({
        position: index + 1,
        servantId: item.servantId,
        servantName: nameByServantId.get(item.servantId) ?? 'Servo',
        value: item.value,
      })),
    };
  }

  async analyticsChurch(
    actor: JwtPayload,
    query?: { startDate?: string; endDate?: string; ministryId?: string },
  ) {
    const churchId = actor.churchId ?? undefined;
    const range = this.resolveDateRange(
      query?.startDate ? new Date(query.startDate) : undefined,
      query?.endDate ? new Date(query.endDate) : undefined,
    );
    if (query?.ministryId && actor.role === Role.COORDENADOR) {
      await assertMinistryAccess(this.prisma, actor, query.ministryId);
    }

    const servantMinistryFilter = query?.ministryId
      ? {
          OR: [
            { mainMinistryId: query.ministryId },
            { servantMinistries: { some: { ministryId: query.ministryId } } },
          ],
        }
      : {};

    const [
      totalActiveServants,
      totalInactiveServants,
      totalNewServants,
      attendancePresent,
      attendanceAbsent,
      tasksCompleted,
      tasksOverdue,
      tasksByMinistryRaw,
      profileAvg,
      growthStarted,
      growthCompleted,
    ] = await Promise.all([
      this.prisma.servant.count({
        where: { deletedAt: null, status: 'ATIVO', ...(churchId ? { churchId } : {}), ...servantMinistryFilter },
      }),
      this.prisma.servant.count({
        where: { deletedAt: null, status: { not: 'ATIVO' }, ...(churchId ? { churchId } : {}), ...servantMinistryFilter },
      }),
      this.prisma.servant.count({
        where: { deletedAt: null, ...(churchId ? { churchId } : {}), ...servantMinistryFilter, createdAt: range },
      }),
      this.prisma.attendance.count({
        where: { deletedAt: null, status: 'PRESENTE', ...(churchId ? { churchId } : {}), createdAt: range },
      }),
      this.prisma.attendance.count({
        where: {
          deletedAt: null,
          status: { in: ['FALTA', 'FALTA_JUSTIFICADA'] },
          ...(churchId ? { churchId } : {}),
          createdAt: range,
        },
      }),
      this.prisma.ministryTaskOccurrence.count({
        where: {
          deletedAt: null,
          status: 'COMPLETED',
          ...(churchId ? { churchId } : {}),
          ...(query?.ministryId ? { ministryId: query.ministryId } : {}),
          completedAt: range,
        },
      }),
      this.prisma.ministryTaskOccurrence.count({
        where: { deletedAt: null, status: 'OVERDUE', ...(churchId ? { churchId } : {}), ...(query?.ministryId ? { ministryId: query.ministryId } : {}) },
      }),
      this.prisma.ministryTaskOccurrence.groupBy({
        by: ['ministryId'],
        where: { deletedAt: null, ...(churchId ? { churchId } : {}), ...(query?.ministryId ? { ministryId: query.ministryId } : {}), createdAt: range },
        _count: { _all: true },
      }),
      this.prisma.servantGamificationProfile.aggregate({
        where: { ...(churchId ? { churchId } : {}), ...(query?.ministryId ? { servant: servantMinistryFilter } : {}) },
        _avg: { totalPoints: true, currentLevelOrder: true },
      }),
      this.prisma.servantGrowthProgress.count({
        where: { ...(churchId ? { churchId } : {}), ...(query?.ministryId ? { growthTrack: { ministryId: query.ministryId } } : {}), updatedAt: range },
      }),
      this.prisma.servantGrowthProgress.count({
        where: { completed: true, ...(churchId ? { churchId } : {}), ...(query?.ministryId ? { growthTrack: { ministryId: query.ministryId } } : {}), completedAt: range },
      }),
    ]);

    const ministryIds = [...new Set(tasksByMinistryRaw.map((item) => item.ministryId))];
    const ministries = ministryIds.length
      ? await this.prisma.ministry.findMany({
          where: { id: { in: ministryIds } },
          select: { id: true, name: true },
        })
      : [];
    const ministryNameById = new Map(ministries.map((item) => [item.id, item.name]));
    const totalAttendance = attendancePresent + attendanceAbsent;
    const totalServants = totalActiveServants + totalInactiveServants;
    const taskLoadPerServant = totalActiveServants ? Number((tasksCompleted / totalActiveServants).toFixed(2)) : 0;
    const retentionRate = totalServants ? Number(((totalActiveServants / totalServants) * 100).toFixed(2)) : 0;

    return {
      churchId: churchId ?? null,
      period: { startDate: range.gte, endDate: range.lte },
      totalActiveServants,
      totalInactiveServants,
      newServantsInPeriod: totalNewServants,
      attendanceRate: totalAttendance ? Number(((attendancePresent / totalAttendance) * 100).toFixed(2)) : 0,
      absenceRate: totalAttendance ? Number(((attendanceAbsent / totalAttendance) * 100).toFixed(2)) : 0,
      tasksCompleted,
      tasksOverdue,
      tasksByMinistry: tasksByMinistryRaw
        .map((item) => ({
          ministryId: item.ministryId,
          ministryName: ministryNameById.get(item.ministryId) ?? 'Ministerio',
          total: item._count._all,
        }))
        .sort((a, b) => b.total - a.total),
      averageTasksPerServant: taskLoadPerServant,
      averagePoints: Number(profileAvg._avg.totalPoints ?? 0),
      averageLevelOrder: Number(profileAvg._avg.currentLevelOrder ?? 0),
      retentionRate,
      growthTracksStarted: growthStarted,
      growthTracksCompleted: growthCompleted,
    };
  }

  async analyticsMinistry(
    actor: JwtPayload,
    ministryId: string,
    query?: { startDate?: string; endDate?: string },
  ) {
    if (actor.role === Role.COORDENADOR) {
      await assertMinistryAccess(this.prisma, actor, ministryId);
    }
    const range = this.resolveDateRange(
      query?.startDate ? new Date(query.startDate) : undefined,
      query?.endDate ? new Date(query.endDate) : undefined,
    );
    const churchId = actor.churchId ?? undefined;

    const [overview, topActive, lowParticipation] = await Promise.all([
      this.analyticsChurch(actor, { ...query, ministryId }),
      this.rankingByMetric('points', { ministryId, limit: 5, startDate: range.gte, endDate: range.lte }, actor),
      this.rankingByMetric('tasks', { ministryId, limit: 5, startDate: range.gte, endDate: range.lte }, actor),
    ]);

    const trainingPending = await this.prisma.servant.count({
      where: {
        deletedAt: null,
        ...(churchId ? { churchId } : {}),
        OR: [{ mainMinistryId: ministryId }, { servantMinistries: { some: { ministryId } } }],
        trainingStatus: 'PENDING',
      },
    });

    return {
      ministryId,
      ...overview,
      topActiveServants: topActive.data,
      lowParticipationServants: [...lowParticipation.data].reverse(),
      trainingPending,
    };
  }

  async analyticsServant(
    actor: JwtPayload,
    servantId: string,
    query?: { startDate?: string; endDate?: string },
  ) {
    const servant = await this.prisma.servant.findFirst({
      where: { id: servantId, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      select: { id: true, name: true, churchId: true, mainMinistryId: true, trainingStatus: true, createdAt: true },
    });
    if (!servant) throw new NotFoundException('Servant not found');
    if (actor.role === Role.COORDENADOR && servant.mainMinistryId) {
      await assertMinistryAccess(this.prisma, actor, servant.mainMinistryId);
    }
    if (actor.role === Role.SERVO && actor.servantId !== servantId) {
      throw new ForbiddenException('You can only view your own analytics');
    }

    const range = this.resolveDateRange(
      query?.startDate ? new Date(query.startDate) : undefined,
      query?.endDate ? new Date(query.endDate) : undefined,
    );

    const [present, absences, tasksCompleted, tasksOverdue, checklistPerfect, progress, growthTracks] =
      await Promise.all([
        this.prisma.attendance.count({
          where: { servantId, deletedAt: null, status: 'PRESENTE', createdAt: range },
        }),
        this.prisma.attendance.count({
          where: { servantId, deletedAt: null, status: { in: ['FALTA', 'FALTA_JUSTIFICADA'] }, createdAt: range },
        }),
        this.prisma.ministryTaskOccurrence.count({
          where: { assignedServantId: servantId, deletedAt: null, status: 'COMPLETED', completedAt: range },
        }),
        this.prisma.ministryTaskOccurrence.count({
          where: { assignedServantId: servantId, deletedAt: null, status: 'OVERDUE' },
        }),
        this.prisma.servantPointLog.count({
          where: { servantId, actionType: 'CHECKLIST_PERFECT', createdAt: range },
        }),
        this.getServantProgress(servantId, servant.churchId ?? undefined),
        this.prisma.servantGrowthProgress.findMany({
          where: { servantId },
          include: {
            growthTrack: { select: { id: true, name: true } },
          },
        }),
      ]);

    const trackMap = new Map<string, { id: string; name: string; total: number; completed: number }>();
    for (const item of growthTracks) {
      const current = trackMap.get(item.growthTrackId) ?? {
        id: item.growthTrack.id,
        name: item.growthTrack.name,
        total: 0,
        completed: 0,
      };
      current.total += 1;
      if (item.completed) current.completed += 1;
      trackMap.set(item.growthTrackId, current);
    }
    const totalAttendance = present + absences;

    return {
      servantId,
      servantName: servant.name,
      period: { startDate: range.gte, endDate: range.lte },
      attendance: {
        present,
        absences,
        attendanceRate: totalAttendance ? Number(((present / totalAttendance) * 100).toFixed(2)) : 0,
      },
      tasks: {
        completed: tasksCompleted,
        overdue: tasksOverdue,
        checklistPerfect,
      },
      gamification: progress,
      trainingStatus: servant.trainingStatus,
      ministrySince: servant.createdAt,
      growthTracks: [...trackMap.values()].map((item) => ({
        ...item,
        percent: item.total ? Math.round((item.completed / item.total) * 100) : 0,
      })),
    };
  }

  async analyticsMe(actor: JwtPayload, query?: { startDate?: string; endDate?: string }) {
    const servantId =
      actor.servantId ??
      (await this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: { servantId: true },
      }))?.servantId;
    if (!servantId) throw new ForbiddenException('User is not linked to a servant');
    return this.analyticsServant(actor, servantId, query);
  }

  async listGrowthTracks(actor: JwtPayload) {
    const where: Prisma.GrowthTrackWhereInput = {
      ...(actor.churchId ? { churchId: actor.churchId } : {}),
    };
    if (actor.role === Role.COORDENADOR) {
      const binding = await this.prisma.userMinistryBinding.findMany({
        where: { userId: actor.sub },
        select: { ministryId: true },
      });
      const ministryIds = binding.map((item) => item.ministryId).filter((item): item is string => Boolean(item));
      where.OR = [{ ministryId: null }, { ministryId: { in: ministryIds } }];
    }
    return this.prisma.growthTrack.findMany({
      where,
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async getGrowthTrack(trackId: string, actor: JwtPayload) {
    const track = await this.prisma.growthTrack.findFirst({
      where: { id: trackId, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        progress: {
          include: {
            servant: { select: { id: true, name: true } },
            verifiedByUser: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!track) throw new NotFoundException('Growth track not found');
    if (actor.role === Role.COORDENADOR && track.ministryId) {
      await assertMinistryAccess(this.prisma, actor, track.ministryId);
    }
    return track;
  }

  async assignServantToTrack(trackId: string, servantId: string, actor: JwtPayload) {
    const track = await this.prisma.growthTrack.findUnique({
      where: { id: trackId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!track) throw new NotFoundException('Growth track not found');
    if (actor.role === Role.COORDENADOR && track.ministryId) {
      await assertMinistryAccess(this.prisma, actor, track.ministryId);
    }

    const servant = await this.prisma.servant.findFirst({
      where: { id: servantId, deletedAt: null, ...(actor.churchId ? { churchId: actor.churchId } : {}) },
      select: { id: true, churchId: true },
    });
    if (!servant) throw new NotFoundException('Servant not found');

    await this.prisma.$transaction(
      track.steps.map((step) =>
        this.prisma.servantGrowthProgress.upsert({
          where: { servantId_stepId: { servantId, stepId: step.id } },
          update: {},
          create: {
            churchId: servant.churchId ?? null,
            servantId,
            growthTrackId: trackId,
            stepId: step.id,
            completed: false,
            progressValue: 0,
          },
        }),
      ),
    );

    return this.getGrowthTrack(trackId, actor);
  }

  async updateGrowthTrackProgress(
    trackId: string,
    servantId: string,
    input: { stepId: string; completed?: boolean; progressValue?: number; notes?: string },
    actor: JwtPayload,
  ) {
    const track = await this.prisma.growthTrack.findUnique({
      where: { id: trackId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!track) throw new NotFoundException('Growth track not found');
    if (actor.role === Role.COORDENADOR && track.ministryId) {
      await assertMinistryAccess(this.prisma, actor, track.ministryId);
    }
    if (actor.role === Role.SERVO && actor.servantId !== servantId) {
      throw new ForbiddenException('You can only update your own growth progress');
    }
    const step = track.steps.find((item) => item.id === input.stepId);
    if (!step) throw new NotFoundException('Growth track step not found');

    const previousSteps = track.steps.filter((item) => item.stepOrder < step.stepOrder);
    if (input.completed && previousSteps.length > 0) {
      const previousDone = await this.prisma.servantGrowthProgress.count({
        where: {
          servantId,
          stepId: { in: previousSteps.map((item) => item.id) },
          completed: true,
        },
      });
      if (previousDone < previousSteps.length) {
        throw new ForbiddenException('Step prerequisites are not completed');
      }
    }

    const current = await this.prisma.servantGrowthProgress.findFirst({
      where: { servantId, growthTrackId: trackId, stepId: input.stepId },
      select: { id: true, completed: true, progressValue: true },
    });

    const completedNow = input.completed ?? current?.completed ?? false;
    const progressValue =
      input.progressValue === undefined
        ? current?.progressValue ?? (completedNow ? 100 : 0)
        : Math.max(0, Math.min(100, input.progressValue));

    const data = await this.prisma.servantGrowthProgress.upsert({
      where: { servantId_stepId: { servantId, stepId: input.stepId } },
      update: {
        completed: completedNow,
        completedAt: completedNow ? new Date() : null,
        progressValue,
        notes: input.notes,
      },
      create: {
        churchId: actor.churchId ?? null,
        servantId,
        growthTrackId: trackId,
        stepId: input.stepId,
        completed: completedNow,
        completedAt: completedNow ? new Date() : null,
        progressValue,
        notes: input.notes,
      },
    });

    if (completedNow) {
      await this.evaluateAchievements(servantId, actor.churchId ?? undefined, actor.sub);
    }
    return data;
  }

  async approveGrowthTrackStep(
    trackId: string,
    input: { servantId: string; stepId: string; notes?: string },
    actor: JwtPayload,
  ) {
    const step = await this.prisma.growthTrackStep.findFirst({
      where: { id: input.stepId, growthTrackId: trackId },
      include: { growthTrack: true },
    });
    if (!step) throw new NotFoundException('Growth track step not found');
    if (!step.manualReview) {
      throw new ForbiddenException('Step does not require manual approval');
    }
    if (actor.role === Role.COORDENADOR && step.growthTrack.ministryId) {
      await assertMinistryAccess(this.prisma, actor, step.growthTrack.ministryId);
    }
    return this.prisma.servantGrowthProgress.upsert({
      where: {
        servantId_stepId: {
          servantId: input.servantId,
          stepId: input.stepId,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
        progressValue: 100,
        notes: input.notes,
        verifiedBy: actor.sub,
      },
      create: {
        churchId: actor.churchId ?? null,
        servantId: input.servantId,
        growthTrackId: trackId,
        stepId: input.stepId,
        completed: true,
        completedAt: new Date(),
        progressValue: 100,
        notes: input.notes,
        verifiedBy: actor.sub,
      },
    });
  }

  async createGrowthTrack(
    input: { name: string; description?: string; ministryId?: string },
    actor: JwtPayload,
  ) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN && actor.role !== Role.COORDENADOR) {
      throw new ForbiddenException('Permission denied');
    }
    if (actor.role === Role.COORDENADOR && input.ministryId) {
      await assertMinistryAccess(this.prisma, actor, input.ministryId);
    }

    return this.prisma.growthTrack.create({
      data: {
        churchId: actor.churchId ?? null,
        ministryId: input.ministryId,
        name: input.name,
        description: input.description,
        createdBy: actor.sub,
      },
    });
  }

  async addGrowthTrackStep(trackId: string, input: {
    title: string;
    stepOrder: number;
    description?: string;
    criteria?: Record<string, unknown>;
    manualReview?: boolean;
  }, actor: JwtPayload) {
    const track = await this.prisma.growthTrack.findUnique({ where: { id: trackId } });
    if (!track) throw new NotFoundException('Growth track not found');
    if (actor.role === Role.COORDENADOR && track.ministryId) {
      await assertMinistryAccess(this.prisma, actor, track.ministryId);
    }
    return this.prisma.growthTrackStep.create({
      data: {
        growthTrackId: trackId,
        title: input.title,
        stepOrder: input.stepOrder,
        description: input.description,
        criteria: input.criteria as Prisma.InputJsonValue | undefined,
        manualReview: input.manualReview ?? false,
        createdBy: actor.sub,
      },
    });
  }

  async myGrowthTracks(actor: JwtPayload) {
    const servantId = actor.servantId ?? (await this.prisma.user.findUnique({ where: { id: actor.sub }, select: { servantId: true } }))?.servantId;
    if (!servantId) return [];
    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: { mainMinistryId: true, servantMinistries: { select: { ministryId: true } } },
    });
    if (!servant) return [];
    const ministryIds = [...new Set([servant.mainMinistryId, ...servant.servantMinistries.map((m) => m.ministryId)].filter(Boolean) as string[])];

    const tracks = await this.prisma.growthTrack.findMany({
      where: {
        active: true,
        ...(actor.churchId ? { churchId: actor.churchId } : {}),
        OR: [{ ministryId: null }, { ministryId: { in: ministryIds } }],
      },
      include: {
        steps: { orderBy: [{ stepOrder: 'asc' }] },
        progress: { where: { servantId } },
      },
      orderBy: [{ name: 'asc' }],
    });

    return tracks.map((track) => {
      const stepProgress = new Map(track.progress.map((item) => [item.stepId, item]));
      const totalSteps = track.steps.length;
      const doneSteps = track.steps.filter((step) => stepProgress.get(step.id)?.completed).length;
      return {
        id: track.id,
        name: track.name,
        ministryId: track.ministryId,
        totalSteps,
        doneSteps,
        percent: totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0,
        steps: track.steps.map((step) => ({
          id: step.id,
          title: step.title,
          stepOrder: step.stepOrder,
          manualReview: step.manualReview,
          criteria: step.criteria,
          progress: stepProgress.get(step.id) ?? null,
        })),
      };
    });
  }

  async listAchievementsCatalog(actor: JwtPayload, servantId?: string) {
    const achievements = await this.prisma.achievement.findMany({
      where: {
        active: true,
        OR: [{ churchId: actor.churchId ?? null }, { churchId: null }],
      },
      orderBy: [{ category: 'asc' }, { pointsBonus: 'asc' }, { name: 'asc' }],
    });
    if (!servantId) return achievements;

    const unlocked = await this.prisma.servantAchievement.findMany({
      where: { servantId },
      select: { achievementId: true, progressValue: true, unlockedAt: true },
    });
    const unlockedById = new Map(unlocked.map((item) => [item.achievementId, item]));

    return Promise.all(
      achievements.map(async (achievement) => {
        const progressValue = await this.evaluateAchievementProgress(servantId, achievement, actor.churchId ?? undefined);
        const minValue = Number(((achievement.criteria ?? {}) as Record<string, unknown>).minValue ?? 1);
        const unlockedItem = unlockedById.get(achievement.id);
        return {
          ...achievement,
          progressValue,
          minValue,
          unlocked: Boolean(unlockedItem),
          unlockedAt: unlockedItem?.unlockedAt ?? null,
        };
      }),
    );
  }

  private defaultAchievementCatalog() {
    return [
      { code: 'ATT_FIRST', name: 'Primeira presenca', description: 'Registrou a primeira presenca em culto.', icon: 'star', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 5, criteria: { kind: 'ATTENDANCE_COUNT', minValue: 1 } },
      { code: 'ATT_5', name: '5 presencas', description: 'Alcancou 5 presencas em culto.', icon: 'award', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 8, criteria: { kind: 'ATTENDANCE_COUNT', minValue: 5 } },
      { code: 'ATT_10', name: '10 presencas', description: 'Alcancou 10 presencas em culto.', icon: 'award', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 10, criteria: { kind: 'ATTENDANCE_COUNT', minValue: 10 } },
      { code: 'ATT_25', name: '25 presencas', description: 'Alcancou 25 presencas em culto.', icon: 'award', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 15, criteria: { kind: 'ATTENDANCE_COUNT', minValue: 25 } },
      { code: 'ATT_50', name: '50 presencas', description: 'Alcancou 50 presencas em culto.', icon: 'award', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 20, criteria: { kind: 'ATTENDANCE_COUNT', minValue: 50 } },
      { code: 'ATT_100', name: '100 presencas', description: 'Alcancou 100 presencas em culto.', icon: 'award', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 35, criteria: { kind: 'ATTENDANCE_COUNT', minValue: 100 } },
      { code: 'ATT_STREAK_10', name: '10 cultos sem faltar', description: 'Sequencia de 10 presencas sem falta.', icon: 'flame', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 20, criteria: { kind: 'CONSECUTIVE_PRESENT_COUNT', minValue: 10 } },
      { code: 'ATT_MONTH_1', name: '1 mes sem faltar', description: 'Conseguiu 1 mes sem registrar falta.', icon: 'calendar-check', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 25, criteria: { kind: 'MONTHS_WITHOUT_ABSENCE', minValue: 1 } },
      { code: 'ATT_MONTH_3', name: '3 meses sem faltar', description: 'Conseguiu 3 meses sem registrar falta.', icon: 'calendar-check', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 40, criteria: { kind: 'MONTHS_WITHOUT_ABSENCE', minValue: 3 } },
      { code: 'ATT_MONTH_6', name: '6 meses sem faltar', description: 'Conseguiu 6 meses sem registrar falta.', icon: 'calendar-check', category: 'PRESENCA', type: AchievementType.ATTENDANCE_STREAK, pointsBonus: 55, criteria: { kind: 'MONTHS_WITHOUT_ABSENCE', minValue: 6 } },
      { code: 'TASK_FIRST', name: 'Primeira tarefa concluida', description: 'Concluiu a primeira tarefa ministerial.', icon: 'check-square', category: 'TAREFAS', type: AchievementType.TASKS_COMPLETED, pointsBonus: 8, criteria: { kind: 'TASK_COMPLETED_COUNT', minValue: 1 } },
      { code: 'TASK_10', name: '10 tarefas concluidas', description: 'Concluiu 10 tarefas ministeriais.', icon: 'check-square', category: 'TAREFAS', type: AchievementType.TASKS_COMPLETED, pointsBonus: 15, criteria: { kind: 'TASK_COMPLETED_COUNT', minValue: 10 } },
      { code: 'TASK_50', name: '50 tarefas concluidas', description: 'Concluiu 50 tarefas ministeriais.', icon: 'check-square', category: 'TAREFAS', type: AchievementType.TASKS_COMPLETED, pointsBonus: 30, criteria: { kind: 'TASK_COMPLETED_COUNT', minValue: 50 } },
      { code: 'TASK_100', name: '100 tarefas concluidas', description: 'Concluiu 100 tarefas ministeriais.', icon: 'check-square', category: 'TAREFAS', type: AchievementType.TASKS_COMPLETED, pointsBonus: 50, criteria: { kind: 'TASK_COMPLETED_COUNT', minValue: 100 } },
      { code: 'TASK_ONTIME_10', name: '10 tarefas sem atraso', description: 'Concluiu 10 tarefas dentro do prazo.', icon: 'timer', category: 'TAREFAS', type: AchievementType.NO_DELAY_STREAK, pointsBonus: 20, criteria: { kind: 'TASK_ON_TIME_COUNT', minValue: 10 } },
      { code: 'CHECKLIST_20', name: '20 checklists perfeitos', description: 'Finalizou 20 checklists perfeitos.', icon: 'list-checks', category: 'TAREFAS', type: AchievementType.CHECKLIST_PERFECT, pointsBonus: 25, criteria: { kind: 'CHECKLIST_PERFECT_COUNT', minValue: 20 } },
      { code: 'CHECKLIST_50', name: '50 checklists perfeitos', description: 'Finalizou 50 checklists perfeitos.', icon: 'list-checks', category: 'TAREFAS', type: AchievementType.CHECKLIST_PERFECT, pointsBonus: 40, criteria: { kind: 'CHECKLIST_PERFECT_COUNT', minValue: 50 } },
      { code: 'CRIT_TASK_FIRST', name: 'Primeira tarefa critica', description: 'Concluiu a primeira tarefa critica.', icon: 'alert-triangle', category: 'TAREFAS', type: AchievementType.CRITICAL_TASK_COMPLETED, pointsBonus: 20, criteria: { kind: 'CRITICAL_TASK_COMPLETED_COUNT', minValue: 1 } },
      { code: 'CRIT_TASK_10', name: '10 tarefas criticas', description: 'Concluiu 10 tarefas criticas.', icon: 'alert-triangle', category: 'TAREFAS', type: AchievementType.CRITICAL_TASK_COMPLETED, pointsBonus: 45, criteria: { kind: 'CRITICAL_TASK_COMPLETED_COUNT', minValue: 10 } },
      { code: 'TRAIN_FIRST', name: 'Primeiro treinamento', description: 'Concluiu o primeiro treinamento.', icon: 'graduation-cap', category: 'TREINAMENTO', type: AchievementType.TRAINING_COMPLETED, pointsBonus: 15, criteria: { kind: 'TRAINING_COMPLETED_COUNT', minValue: 1 } },
      { code: 'TRAIN_3', name: '3 treinamentos', description: 'Concluiu 3 treinamentos.', icon: 'graduation-cap', category: 'TREINAMENTO', type: AchievementType.TRAINING_COMPLETED, pointsBonus: 30, criteria: { kind: 'TRAINING_COMPLETED_COUNT', minValue: 3 } },
      { code: 'TRAIN_5', name: '5 treinamentos', description: 'Concluiu 5 treinamentos.', icon: 'graduation-cap', category: 'TREINAMENTO', type: AchievementType.TRAINING_COMPLETED, pointsBonus: 45, criteria: { kind: 'TRAINING_COMPLETED_COUNT', minValue: 5 } },
      { code: 'TRACK_BASIC_DONE', name: 'Trilha basica concluida', description: 'Concluiu ao menos 1 trilha.', icon: 'route', category: 'TRILHAS', type: AchievementType.MANUAL, pointsBonus: 25, criteria: { kind: 'GROWTH_TRACK_COMPLETED_COUNT', minValue: 1 } },
      { code: 'TRACK_LEADER_DONE', name: 'Trilha de lideranca concluida', description: 'Concluiu 2 trilhas de crescimento.', icon: 'route', category: 'TRILHAS', type: AchievementType.MANUAL, pointsBonus: 40, criteria: { kind: 'GROWTH_TRACK_COMPLETED_COUNT', minValue: 2 } },
      { code: 'TIME_3M', name: '3 meses servindo', description: 'Permaneceu ativo por 3 meses.', icon: 'clock-3', category: 'TEMPO', type: AchievementType.MINISTRY_TIME, pointsBonus: 15, criteria: { kind: 'MINISTRY_TIME_MONTHS', minValue: 3 } },
      { code: 'TIME_6M', name: '6 meses servindo', description: 'Permaneceu ativo por 6 meses.', icon: 'clock-3', category: 'TEMPO', type: AchievementType.MINISTRY_TIME, pointsBonus: 20, criteria: { kind: 'MINISTRY_TIME_MONTHS', minValue: 6 } },
      { code: 'TIME_1Y', name: '1 ano servindo', description: 'Permaneceu ativo por 1 ano.', icon: 'clock-3', category: 'TEMPO', type: AchievementType.MINISTRY_TIME, pointsBonus: 30, criteria: { kind: 'MINISTRY_TIME_MONTHS', minValue: 12 } },
      { code: 'TIME_2Y', name: '2 anos servindo', description: 'Permaneceu ativo por 2 anos.', icon: 'clock-3', category: 'TEMPO', type: AchievementType.MINISTRY_TIME, pointsBonus: 45, criteria: { kind: 'MINISTRY_TIME_MONTHS', minValue: 24 } },
      { code: 'TIME_5Y', name: '5 anos servindo', description: 'Permaneceu ativo por 5 anos.', icon: 'clock-3', category: 'TEMPO', type: AchievementType.MINISTRY_TIME, pointsBonus: 80, criteria: { kind: 'MINISTRY_TIME_MONTHS', minValue: 60 } },
      { code: 'LEAD_FIRST', name: 'Primeira lideranca', description: 'Liderou equipe pela primeira vez.', icon: 'crown', category: 'LIDERANCA', type: AchievementType.LEADERSHIP, pointsBonus: 20, criteria: { kind: 'LEADERSHIP_COUNT', minValue: 1 } },
      { code: 'LEAD_5', name: 'Liderou 5 vezes', description: 'Liderou equipe em 5 ocasioes.', icon: 'crown', category: 'LIDERANCA', type: AchievementType.LEADERSHIP, pointsBonus: 35, criteria: { kind: 'LEADERSHIP_COUNT', minValue: 5 } },
      { code: 'LEAD_20', name: 'Liderou 20 vezes', description: 'Liderou equipe em 20 ocasioes.', icon: 'crown', category: 'LIDERANCA', type: AchievementType.LEADERSHIP, pointsBonus: 70, criteria: { kind: 'LEADERSHIP_COUNT', minValue: 20 } },
      { code: 'FORM_NEW_SERVANT', name: 'Formou novo servo', description: 'Apoiou formacao de novo servo.', icon: 'user-plus', category: 'LIDERANCA', type: AchievementType.LEADERSHIP, pointsBonus: 30, criteria: { kind: 'LEADERSHIP_COUNT', minValue: 3 } },
      { code: 'FORM_LEADER', name: 'Formou lider', description: 'Apoiou formacao de um lider.', icon: 'user-up', category: 'LIDERANCA', type: AchievementType.LEADERSHIP, pointsBonus: 50, criteria: { kind: 'LEADERSHIP_COUNT', minValue: 10 } },
      { code: 'HELP_OTHER_TEAM', name: 'Ajudou outra equipe', description: 'Apoiou operacao de outro time.', icon: 'handshake', category: 'ENGAJAMENTO', type: AchievementType.CROSS_TEAM_HELP, pointsBonus: 15, criteria: { kind: 'POINT_LOG_COUNT', actionType: 'HELPED_OTHER_TEAM', minValue: 1 } },
      { code: 'EXTRA_TASK', name: 'Assumiu tarefa extra', description: 'Assumiu tarefa fora da rotina.', icon: 'plus-circle', category: 'ENGAJAMENTO', type: AchievementType.MANUAL, pointsBonus: 20, criteria: { kind: 'POINT_LOG_COUNT', actionType: 'EXTRA_TASK_ASSUMED', minValue: 1 } },
      { code: 'SPECIAL_EVENT', name: 'Evento especial', description: 'Serviu em evento especial.', icon: 'sparkles', category: 'ENGAJAMENTO', type: AchievementType.SPECIAL_EVENT, pointsBonus: 20, criteria: { kind: 'POINT_LOG_COUNT', actionType: 'SPECIAL_EVENT', minValue: 1 } },
      { code: 'MINISTRY_2', name: 'Serviu em 2 ministerios', description: 'Atuou em pelo menos 2 ministerios.', icon: 'layers', category: 'ENGAJAMENTO', type: AchievementType.MULTI_MINISTRY, pointsBonus: 25, criteria: { kind: 'MULTI_MINISTRY_COUNT', minValue: 2 } },
      { code: 'MINISTRY_3', name: 'Serviu em 3 ministerios', description: 'Atuou em pelo menos 3 ministerios.', icon: 'layers', category: 'ENGAJAMENTO', type: AchievementType.MULTI_MINISTRY, pointsBonus: 40, criteria: { kind: 'MULTI_MINISTRY_COUNT', minValue: 3 } },
    ] as const;
  }

  private async evaluateAchievementProgress(
    servantId: string,
    achievement: { criteria: Prisma.JsonValue | null; code: string; type: AchievementType },
    churchId?: string,
  ) {
    const criteria = (achievement.criteria ?? {}) as Record<string, unknown>;
    const kind = String(criteria.kind ?? 'POINT_LOG_COUNT');
    const actionType = criteria.actionType as GamificationActionType | undefined;
    switch (kind) {
      case 'POINT_LOG_COUNT':
        if (!actionType) return 0;
        return this.prisma.servantPointLog.count({
          where: { servantId, actionType, ...(churchId ? { churchId } : {}) },
        });
      case 'ATTENDANCE_COUNT':
        return this.prisma.attendance.count({
          where: { servantId, deletedAt: null, status: 'PRESENTE', ...(churchId ? { churchId } : {}) },
        });
      case 'TASK_COMPLETED_COUNT':
        return this.prisma.ministryTaskOccurrence.count({
          where: { assignedServantId: servantId, deletedAt: null, status: 'COMPLETED', ...(churchId ? { churchId } : {}) },
        });
      case 'TASK_ON_TIME_COUNT':
        return this.prisma.servantPointLog.count({
          where: { servantId, actionType: 'TASK_BEFORE_DUE', ...(churchId ? { churchId } : {}) },
        });
      case 'CHECKLIST_PERFECT_COUNT':
        return this.prisma.servantPointLog.count({
          where: { servantId, actionType: 'CHECKLIST_PERFECT', ...(churchId ? { churchId } : {}) },
        });
      case 'CRITICAL_TASK_COMPLETED_COUNT':
        return this.prisma.ministryTaskOccurrence.count({
          where: { assignedServantId: servantId, deletedAt: null, status: 'COMPLETED', criticality: 'CRITICAL', ...(churchId ? { churchId } : {}) },
        });
      case 'TRAINING_COMPLETED_COUNT': {
        const servant = await this.prisma.servant.findUnique({
          where: { id: servantId },
          select: { servantMinistries: { where: { trainingStatus: 'COMPLETED' }, select: { id: true } } },
        });
        return servant?.servantMinistries.length ?? 0;
      }
      case 'GROWTH_TRACK_COMPLETED_COUNT': {
        const completedTracks = await this.prisma.servantGrowthProgress.findMany({
          where: { servantId, completed: true, ...(churchId ? { churchId } : {}) },
          select: { growthTrackId: true },
        });
        return new Set(completedTracks.map((item) => item.growthTrackId)).size;
      }
      case 'MINISTRY_TIME_MONTHS': {
        const servant = await this.prisma.servant.findUnique({ where: { id: servantId }, select: { createdAt: true } });
        if (!servant) return 0;
        const now = new Date();
        const months = (now.getUTCFullYear() - servant.createdAt.getUTCFullYear()) * 12 + (now.getUTCMonth() - servant.createdAt.getUTCMonth());
        return months;
      }
      case 'LEADERSHIP_COUNT':
        return this.prisma.servantPointLog.count({
          where: { servantId, actionType: 'TEAM_LEADERSHIP', ...(churchId ? { churchId } : {}) },
        });
      case 'MULTI_MINISTRY_COUNT': {
        const servant = await this.prisma.servant.findUnique({
          where: { id: servantId },
          select: { mainMinistryId: true, servantMinistries: { select: { ministryId: true } } },
        });
        if (!servant) return 0;
        const ministries = new Set(
          [servant.mainMinistryId, ...servant.servantMinistries.map((item) => item.ministryId)].filter(Boolean),
        );
        return ministries.size;
      }
      case 'CONSECUTIVE_PRESENT_COUNT': {
        const rows = await this.prisma.attendance.findMany({
          where: { servantId, deletedAt: null, ...(churchId ? { churchId } : {}) },
          orderBy: { createdAt: 'desc' },
          select: { status: true },
          take: 365,
        });
        let streak = 0;
        for (const row of rows) {
          if (row.status === 'PRESENTE') streak += 1;
          else break;
        }
        return streak;
      }
      case 'MONTHS_WITHOUT_ABSENCE': {
        const rows = await this.prisma.attendance.findMany({
          where: { servantId, deletedAt: null, ...(churchId ? { churchId } : {}) },
          select: { status: true, createdAt: true },
        });
        const monthMap = new Map<string, { hasAbsence: boolean; hasPresence: boolean }>();
        for (const row of rows) {
          const key = `${row.createdAt.getUTCFullYear()}-${String(row.createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
          const current = monthMap.get(key) ?? { hasAbsence: false, hasPresence: false };
          if (row.status === 'PRESENTE') current.hasPresence = true;
          if (row.status === 'FALTA' || row.status === 'FALTA_JUSTIFICADA') current.hasAbsence = true;
          monthMap.set(key, current);
        }
        return [...monthMap.values()].filter((item) => item.hasPresence && !item.hasAbsence).length;
      }
      default:
        return 0;
    }
  }

  private resolveDateRange(startDate?: Date, endDate?: Date, month?: number, year?: number) {
    if (startDate || endDate) {
      return {
        gte: startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lte: endDate ?? new Date(),
      } satisfies Prisma.DateTimeFilter;
    }
    if (month && year) {
      return {
        gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
        lte: new Date(Date.UTC(year, month, 0, 23, 59, 59)),
      } satisfies Prisma.DateTimeFilter;
    }
    if (year) {
      return {
        gte: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
        lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
      } satisfies Prisma.DateTimeFilter;
    }
    return {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      lte: new Date(),
    } satisfies Prisma.DateTimeFilter;
  }

  async evaluateAchievements(servantId: string, churchId?: string, actorUserId?: string) {
    await this.syncDefaultAchievementsCatalog(actorUserId, churchId ?? null);
    const achievements = await this.prisma.achievement.findMany({
      where: {
        active: true,
        OR: [{ churchId: churchId ?? null }, { churchId: null }],
      },
    });

    for (const achievement of achievements) {
      const progressValue = await this.evaluateAchievementProgress(servantId, achievement, churchId ?? undefined);
      const minValue = Number(((achievement.criteria ?? {}) as Record<string, unknown>).minValue ?? 1);
      if (progressValue < minValue) continue;

      const already = await this.prisma.servantAchievement.findFirst({
        where: { servantId, achievementId: achievement.id },
        select: { id: true },
      });
      if (already) continue;

      await this.prisma.servantAchievement.create({
        data: {
          churchId: churchId ?? null,
          servantId,
          achievementId: achievement.id,
          progressValue,
          unlockedBy: actorUserId,
        },
      });

      if (achievement.pointsBonus > 0) {
        await this.awardPoints({
          servantId,
          churchId,
          actionType: GamificationActionType.MANUAL,
          referenceId: `achievement:${achievement.id}:${servantId}`,
          metadata: { achievementId: achievement.id, bonus: true },
          actorUserId,
        });
      }

      await this.auditService.log({
        action: AuditAction.GAMIFICATION_ACHIEVEMENT_UNLOCKED,
        entity: 'ServantAchievement',
        entityId: `${servantId}:${achievement.id}`,
        userId: actorUserId,
        metadata: { servantId, achievementId: achievement.id },
      });
      await this.eventBus.emit({
        name: 'GAMIFICATION_ACHIEVEMENT_UNLOCKED',
        occurredAt: new Date(),
        actorUserId,
        churchId: churchId ?? null,
        payload: {
          servantId,
          achievementId: achievement.id,
          achievementCode: achievement.code,
        },
      });
    }

    await this.recomputeServantProfile(servantId, churchId);
  }

  async recomputeAllProfiles(churchId?: string) {
    const servants = await this.prisma.servant.findMany({
      where: { deletedAt: null, status: 'ATIVO', ...(churchId ? { churchId } : {}) },
      select: { id: true, churchId: true },
    });
    for (const servant of servants) {
      await this.recomputeServantProfile(servant.id, servant.churchId ?? undefined);
    }
    return { processed: servants.length };
  }

  async buildMonthlyStats(referenceMonth = new Date()) {
    const monthStart = new Date(Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth(), 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth() + 1, 0, 23, 59, 59));

    const servants = await this.prisma.servant.findMany({
      where: { deletedAt: null, status: 'ATIVO' },
      select: { id: true, churchId: true, mainMinistryId: true },
    });

    for (const servant of servants) {
      const [attendanceConfirmed, absences, tasksCompleted, tasksOverdue, checklistPerfect, pointsEarned] =
        await Promise.all([
          this.prisma.attendance.count({ where: { servantId: servant.id, status: 'PRESENTE', createdAt: { gte: monthStart, lte: monthEnd } } }),
          this.prisma.attendance.count({ where: { servantId: servant.id, status: { in: ['FALTA', 'FALTA_JUSTIFICADA'] }, createdAt: { gte: monthStart, lte: monthEnd } } }),
          this.prisma.ministryTaskOccurrence.count({ where: { assignedServantId: servant.id, status: 'COMPLETED', updatedAt: { gte: monthStart, lte: monthEnd } } }),
          this.prisma.ministryTaskOccurrence.count({ where: { assignedServantId: servant.id, status: 'OVERDUE', updatedAt: { gte: monthStart, lte: monthEnd } } }),
          this.prisma.servantPointLog.count({ where: { servantId: servant.id, actionType: 'CHECKLIST_PERFECT', createdAt: { gte: monthStart, lte: monthEnd } } }),
          this.prisma.servantPointLog.aggregate({ where: { servantId: servant.id, createdAt: { gte: monthStart, lte: monthEnd } }, _sum: { points: true } }),
        ]);

      const existing = await this.prisma.servantMonthlyStats.findFirst({
        where: {
          servantId: servant.id,
          referenceMonth: monthStart,
          ministryId: servant.mainMinistryId ?? null,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.servantMonthlyStats.update({
          where: { id: existing.id },
          data: {
            churchId: servant.churchId,
            attendanceConfirmed,
            absences,
            tasksCompleted,
            tasksOverdue,
            checklistPerfect,
            pointsEarned: Number(pointsEarned._sum.points ?? 0),
          },
        });
      } else {
        await this.prisma.servantMonthlyStats.create({
          data: {
            churchId: servant.churchId,
            ministryId: servant.mainMinistryId,
            servantId: servant.id,
            referenceMonth: monthStart,
            attendanceConfirmed,
            absences,
            tasksCompleted,
            tasksOverdue,
            checklistPerfect,
            pointsEarned: Number(pointsEarned._sum.points ?? 0),
          },
        });
      }
    }

    return { processed: servants.length, referenceMonth: monthStart };
  }
}
