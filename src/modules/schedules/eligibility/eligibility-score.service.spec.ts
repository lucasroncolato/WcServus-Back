import { AttendanceStatus } from '@prisma/client';
import { EligibilityScoreService } from './eligibility-score.service';

describe('EligibilityScoreService', () => {
  const prisma = {
    schedule: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    attendance: {
      groupBy: jest.fn(),
    },
  } as any;

  let service: EligibilityScoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.schedule.findFirst.mockResolvedValue(null);
    prisma.schedule.count.mockResolvedValue(0);
    service = new EligibilityScoreService(prisma);
  });

  it('treats LATE as presence and NO_SHOW as absence in score calculation', async () => {
    prisma.attendance.groupBy.mockResolvedValue([
      { status: AttendanceStatus.LATE, _count: { status: 2 } },
      { status: AttendanceStatus.NO_SHOW, _count: { status: 1 } },
    ]);

    const result = await service.score({
      ministryId: 'ministry-1',
      conflictMinistryIds: [],
      servant: {
        id: 'servant-1',
        trainingStatus: 'COMPLETED',
        aptitude: 'OPERACIONAL',
      } as any,
      slot: { requiredTraining: true } as any,
      requiredAptitude: 'OPERACIONAL' as any,
      unavailableAtServiceTime: false,
      hasPastoralPending: false,
    });

    expect(result.score).toBeGreaterThan(0);
    expect(prisma.attendance.groupBy).toHaveBeenCalled();
  });

  it('applies policy eligibility impact by status', async () => {
    const context = {
      ministryId: 'ministry-1',
      conflictMinistryIds: [],
      servant: {
        id: 'servant-1',
        trainingStatus: 'COMPLETED',
        aptitude: 'OPERACIONAL',
      } as any,
      slot: { requiredTraining: true } as any,
      requiredAptitude: 'OPERACIONAL' as any,
      unavailableAtServiceTime: false,
      hasPastoralPending: false,
    };

    prisma.attendance.groupBy.mockResolvedValueOnce([
      { status: AttendanceStatus.EXTRA_SERVICE, _count: { status: 1 } },
    ]);
    const positive = await service.score(context);

    prisma.attendance.groupBy.mockResolvedValueOnce([
      { status: AttendanceStatus.NO_SHOW, _count: { status: 1 } },
    ]);
    const negative = await service.score(context);

    expect(positive.score).toBeGreaterThan(negative.score);
  });
});
