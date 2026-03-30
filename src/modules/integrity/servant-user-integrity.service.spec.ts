import { ServantUserIntegrityService } from './servant-user-integrity.service';

describe('ServantUserIntegrityService', () => {
  const prisma = {
    $queryRawUnsafe: jest.fn(),
  } as any;

  let service: ServantUserIntegrityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServantUserIntegrityService(prisma);
  });

  it('reads summary rows from summary view', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        issueType: 'SERVO_USER_WITHOUT_SERVANT',
        severity: 'blocking',
        churchId: 'church-1',
        issueCount: 2,
        affectedUsers: 2,
        affectedServants: 0,
      },
    ]);

    const result = await service.listSummary({ churchId: 'church-1' });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      issueType: 'SERVO_USER_WITHOUT_SERVANT',
      severity: 'blocking',
      issueCount: 2,
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('summary_view'), 'church-1');
  });

  it('classifies scan as blocking when blocking issues exist', async () => {
    jest.spyOn(service, 'listSummary').mockResolvedValueOnce([
      {
        issueType: 'SERVO_USER_WITHOUT_SERVANT',
        severity: 'blocking',
        churchId: 'church-1',
        issueCount: 1,
        affectedUsers: 1,
        affectedServants: 0,
      },
      {
        issueType: 'SERVANT_WITHOUT_USER',
        severity: 'manual_review',
        churchId: 'church-1',
        issueCount: 3,
        affectedUsers: 0,
        affectedServants: 3,
      },
    ]);

    const scan = await service.runScan({ churchId: 'church-1' });

    expect(scan.status).toBe('blocking');
    expect(scan.totals).toEqual({
      blocking: 1,
      manualReview: 3,
      total: 4,
    });
  });

  it('classifies scan as manual_review when there are no blocking issues', async () => {
    jest.spyOn(service, 'listSummary').mockResolvedValueOnce([
      {
        issueType: 'SERVANT_WITHOUT_USER',
        severity: 'manual_review',
        churchId: 'church-1',
        issueCount: 2,
        affectedUsers: 0,
        affectedServants: 2,
      },
    ]);

    const scan = await service.runScan({ churchId: 'church-1' });

    expect(scan.status).toBe('manual_review');
    expect(scan.totals.blocking).toBe(0);
    expect(scan.totals.manualReview).toBe(2);
  });
});
