import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const prisma = {
    ministry: { findFirst: jest.fn(), findMany: jest.fn() },
    team: { findFirst: jest.fn() },
    servant: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  } as any;

  const cache = {
    getOrSet: jest.fn(async (_key: unknown, _ttl: number, factory: () => Promise<unknown>) => factory()),
  } as any;

  const aggregator = {
    churchSummary: jest.fn().mockResolvedValue({ ok: true, meta: {} }),
    churchTrends: jest.fn().mockResolvedValue({ ok: true }),
    churchPastoralSummary: jest.fn().mockResolvedValue({ ok: true }),
    ministrySummary: jest.fn().mockResolvedValue({ ok: true, meta: {} }),
    teamSummary: jest.fn().mockResolvedValue({ ok: true, meta: {} }),
    servantOperationalSummary: jest.fn().mockResolvedValue({ ok: true, meta: {} }),
    timelineSummary: jest.fn().mockResolvedValue({ ok: true }),
  } as any;

  const snapshots = {
    getChurchSnapshot: jest.fn().mockResolvedValue(null),
    getMinistrySnapshot: jest.fn().mockResolvedValue(null),
    getTeamSnapshot: jest.fn().mockResolvedValue(null),
    getServantSnapshot: jest.fn().mockResolvedValue(null),
    upsertChurchSnapshot: jest.fn().mockResolvedValue(undefined),
    upsertMinistrySnapshot: jest.fn().mockResolvedValue(undefined),
    upsertTeamSnapshot: jest.fn().mockResolvedValue(undefined),
    upsertServantSnapshot: jest.fn().mockResolvedValue(undefined),
  } as any;

  const metrics = {
    incrementCounter: jest.fn(),
  } as any;

  let service: AnalyticsService;

  const adminActor = {
    sub: 'user-admin',
    email: 'admin@test.com',
    role: Role.ADMIN,
    churchId: 'church-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService(prisma, cache, aggregator, snapshots, metrics);

    prisma.ministry.findFirst.mockResolvedValue({ id: 'min-1' });
    prisma.team.findFirst.mockResolvedValue({ id: 'team-1', ministryId: 'min-1' });
    prisma.servant.findFirst.mockResolvedValue({ id: 'serv-1' });
    prisma.ministry.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({
      scope: 'GLOBAL',
      servantId: null,
      scopeBindings: [],
      permissionOverrides: [],
    });
  });

  it('calls church summary through cache', async () => {
    const result = await service.church(adminActor as any, { window: '30d' } as any);

    expect(cache.getOrSet).toHaveBeenCalled();
    expect(aggregator.churchSummary).toHaveBeenCalled();
    expect((result as any).meta.isSnapshot).toBe(false);
    expect((result as any).meta.fallback).toBe(true);
  });

  it('prefers church snapshot when available for materialized windows', async () => {
    snapshots.getChurchSnapshot.mockResolvedValueOnce({
      summary: { fromSnapshot: true, meta: { generatedAt: 'x' } },
      generatedAt: new Date('2026-03-31T10:00:00.000Z'),
    });

    const result = await service.church(adminActor as any, { window: '30d' } as any);

    expect(snapshots.getChurchSnapshot).toHaveBeenCalled();
    expect(aggregator.churchSummary).not.toHaveBeenCalled();
    expect((result as any).fromSnapshot).toBe(true);
    expect((result as any).meta.isSnapshot).toBe(true);
    expect((result as any).meta.fallback).toBe(false);
  });

  it('denies actor without church context', async () => {
    await expect(
      service.church({ ...adminActor, churchId: null } as any, { window: '30d' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies coordinator outside ministry scope', async () => {
    prisma.ministry.findMany.mockResolvedValue([{ id: 'min-allowed' }]);
    prisma.user.findUnique.mockResolvedValue({
      scope: 'MINISTRY',
      servantId: null,
      scopeBindings: [{ ministryId: 'min-allowed', teamId: null }],
      permissionOverrides: [],
    });

    await expect(
      service.ministry(
        {
          sub: 'coord-1',
          email: 'coord@test.com',
          role: Role.COORDENADOR,
          churchId: 'church-1',
        } as any,
        'min-other',
        { window: '30d' } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when servant is missing after scope check', async () => {
    prisma.servant.findFirst.mockResolvedValueOnce({ id: 'serv-1' }).mockResolvedValueOnce(null);

    await expect(service.servant(adminActor as any, 'serv-1', { window: '30d' } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
