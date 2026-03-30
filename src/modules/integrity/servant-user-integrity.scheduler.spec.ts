import { ServantUserIntegrityScheduler } from './servant-user-integrity.scheduler';

describe('ServantUserIntegrityScheduler', () => {
  const integrityService = {
    runScan: jest.fn(),
  } as any;
  const metricsService = {
    recordJob: jest.fn(),
    incrementCounter: jest.fn(),
  } as any;
  const logService = {
    log: jest.fn(),
    event: jest.fn(),
    error: jest.fn(),
  } as any;

  let scheduler: ServantUserIntegrityScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new ServantUserIntegrityScheduler(integrityService, metricsService, logService);
  });

  it('logs error when scan is blocking', async () => {
    integrityService.runScan.mockResolvedValueOnce({
      status: 'blocking',
      totals: { blocking: 2, manualReview: 0, total: 2 },
      byIssueType: [{ issueType: 'SERVO_USER_WITHOUT_SERVANT', severity: 'blocking', issueCount: 2 }],
    });

    await (scheduler as any).executeScan();

    expect(logService.event).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        action: 'scan.blocking',
      }),
    );
    expect(metricsService.recordJob).toHaveBeenCalledWith(
      'servant_user_integrity_scan',
      expect.any(Number),
      true,
      expect.objectContaining({ processedItems: 2 }),
    );
  });

  it('logs warning when scan requires manual review only', async () => {
    integrityService.runScan.mockResolvedValueOnce({
      status: 'manual_review',
      totals: { blocking: 0, manualReview: 3, total: 3 },
      byIssueType: [{ issueType: 'SERVANT_WITHOUT_USER', severity: 'manual_review', issueCount: 3 }],
    });

    await (scheduler as any).executeScan();

    expect(logService.event).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        action: 'scan.manual_review',
      }),
    );
  });

  it('records failure metrics when scan throws', async () => {
    integrityService.runScan.mockRejectedValueOnce(new Error('db-down'));

    await (scheduler as any).executeScan();

    expect(metricsService.recordJob).toHaveBeenCalledWith(
      'servant_user_integrity_scan',
      expect.any(Number),
      false,
    );
    expect(logService.error).toHaveBeenCalledWith(
      'Servant/User integrity scan failed',
      expect.stringContaining('db-down'),
      ServantUserIntegrityScheduler.name,
    );
  });
});
