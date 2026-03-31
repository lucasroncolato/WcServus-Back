import { AnalyticsSnapshotScheduler } from './analytics-snapshot.scheduler';

describe('AnalyticsSnapshotScheduler', () => {
  const snapshots = {
    resolveIntervalMs: jest.fn().mockReturnValue(60_000),
    refreshAllSnapshots: jest.fn().mockResolvedValue({ refreshed: 2, failed: 0 }),
  } as any;

  const logService = {
    log: jest.fn(),
    event: jest.fn(),
    error: jest.fn(),
  } as any;

  const metrics = {
    recordJob: jest.fn(),
    incrementCounter: jest.fn(),
  } as any;

  let scheduler: AnalyticsSnapshotScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new AnalyticsSnapshotScheduler(snapshots, logService, metrics);
  });

  it('runs scheduler cycle successfully', async () => {
    const result = await scheduler.runNow();

    expect(snapshots.refreshAllSnapshots).toHaveBeenCalled();
    expect(metrics.recordJob).toHaveBeenCalled();
    expect((result as any).skipped).toBe(false);
  });

  it('records failure when refresh throws', async () => {
    snapshots.refreshAllSnapshots.mockRejectedValueOnce(new Error('boom'));

    const result = await scheduler.runNow();

    expect(metrics.recordJob).toHaveBeenCalledWith(
      'analytics_snapshot_materialization',
      expect.any(Number),
      false,
    );
    expect((result as any).failed).toBe(1);
  });
});
