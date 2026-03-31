import { AnalyticsSnapshotService } from './analytics-snapshot.service';

describe('AnalyticsSnapshotService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    church: { findMany: jest.fn() },
    ministry: { findMany: jest.fn(), findFirst: jest.fn() },
    team: { findMany: jest.fn(), findFirst: jest.fn() },
    servant: { findMany: jest.fn(), findFirst: jest.fn() },
  } as any;

  const aggregator = {
    churchSummary: jest.fn().mockResolvedValue({ summary: { ok: true }, meta: {} }),
    ministrySummary: jest.fn().mockResolvedValue({ summary: { ok: true }, meta: {} }),
    teamSummary: jest.fn().mockResolvedValue({ summary: { ok: true }, meta: {} }),
    servantOperationalSummary: jest.fn().mockResolvedValue({ summary: { ok: true }, meta: {} }),
  } as any;

  const metrics = {
    incrementCounter: jest.fn(),
  } as any;

  const logService = {
    event: jest.fn(),
  } as any;

  let service: AnalyticsSnapshotService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsSnapshotService(prisma, aggregator, metrics, logService);
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.church.findMany.mockResolvedValue([{ id: 'church-1' }]);
    prisma.ministry.findMany.mockResolvedValue([{ id: 'min-1' }]);
    prisma.team.findMany.mockResolvedValue([{ id: 'team-1' }]);
    prisma.servant.findMany.mockResolvedValue([{ id: 'serv-1' }]);
  });

  it('refreshes church snapshot', async () => {
    const result = await service.refreshChurchSnapshot('church-1', '30d');

    expect(aggregator.churchSummary).toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(result.churchId).toBe('church-1');
  });

  it('refreshes ministry/team/servant snapshots', async () => {
    await service.refreshMinistrySnapshot('church-1', 'min-1', '30d');
    await service.refreshTeamSnapshot('church-1', 'team-1', '30d');
    await service.refreshServantSnapshot('church-1', 'serv-1', '30d');

    expect(aggregator.ministrySummary).toHaveBeenCalled();
    expect(aggregator.teamSummary).toHaveBeenCalled();
    expect(aggregator.servantOperationalSummary).toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('returns null when snapshot table is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('relation does not exist'));

    const result = await service.getChurchSnapshot(
      'church-1',
      '30d',
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.000Z'),
    );

    expect(result).toBeNull();
  });

  it('runs materialization cycle with all scopes', async () => {
    const result = await service.refreshAllSnapshots({ windows: ['30d'] });

    expect(result.churchesAnalyzed).toBe(1);
    expect(result.refreshed).toBe(4);
    expect(result.failed).toBe(0);
  });

  it('tracks failed refresh without breaking cycle', async () => {
    aggregator.ministrySummary.mockRejectedValueOnce(new Error('boom'));

    const result = await service.refreshAllSnapshots({ windows: ['30d'] });

    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(result.refreshed).toBeGreaterThanOrEqual(3);
  });

  it('can refresh scope by id', async () => {
    prisma.ministry.findFirst.mockResolvedValueOnce({ id: 'min-1', churchId: 'church-1' });
    prisma.team.findFirst.mockResolvedValueOnce({ id: 'team-1', churchId: 'church-1' });
    prisma.servant.findFirst.mockResolvedValueOnce({ id: 'serv-1', churchId: 'church-1' });

    await service.refreshMinistryById('min-1', ['30d']);
    await service.refreshTeamById('team-1', ['30d']);
    await service.refreshServantById('serv-1', ['30d']);

    expect(aggregator.ministrySummary).toHaveBeenCalled();
    expect(aggregator.teamSummary).toHaveBeenCalled();
    expect(aggregator.servantOperationalSummary).toHaveBeenCalled();
  });
});
