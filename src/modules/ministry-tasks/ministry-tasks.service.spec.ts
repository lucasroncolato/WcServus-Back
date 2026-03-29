import { MinistryTaskOccurrenceStatus, MinistryTaskRecurrenceType, TrainingStatus } from '@prisma/client';
import { MinistryTasksService } from './ministry-tasks.service';

function createService() {
  const prisma = {
    worshipService: { findMany: jest.fn(), findFirst: jest.fn() },
    servant: { findFirst: jest.fn() },
    pastoralVisit: { count: jest.fn() },
    pastoralAlert: { count: jest.fn() },
    ministryTaskTemplate: { findUnique: jest.fn() },
    ministryTaskOccurrence: { count: jest.fn() },
    ministryTaskOccurrenceAssignee: { upsert: jest.fn(), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    ministryTaskOccurrenceAssignmentHistory: { create: jest.fn() },
    schedule: { count: jest.fn() },
    ministry: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  } as any;

  const auditService = { log: jest.fn() } as any;
  const notificationsService = { notifyServantLinkedUser: jest.fn(), createMany: jest.fn() } as any;
  const gamificationService = { awardPoints: jest.fn() } as any;
  const eventBus = { emit: jest.fn() } as any;

  const service = new MinistryTasksService(prisma, auditService, notificationsService, gamificationService, eventBus);
  return { service, prisma };
}

describe('MinistryTasksService', () => {
  it('builds first-service-of-month recurrence list', async () => {
    const { service, prisma } = createService();
    prisma.worshipService.findMany.mockResolvedValue([
      { id: 's1', serviceDate: new Date('2026-04-01T19:00:00.000Z') },
      { id: 's2', serviceDate: new Date('2026-04-15T19:00:00.000Z') },
      { id: 's3', serviceDate: new Date('2026-05-03T19:00:00.000Z') },
      { id: 's4', serviceDate: new Date('2026-05-20T19:00:00.000Z') },
    ]);

    const result = await (service as any).recurrenceDates(
      { recurrenceType: MinistryTaskRecurrenceType.FIRST_SERVICE_OF_MONTH, churchId: 'church-1' },
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-05-31T23:59:59.000Z'),
    );

    expect(result).toHaveLength(2);
    expect(result[0].serviceId).toBe('s1');
    expect(result[1].serviceId).toBe('s3');
  });

  it('blocks assignment when monthly limit reached', async () => {
    const { service, prisma } = createService();
    prisma.servant.findFirst.mockResolvedValue({
      id: 'servant-1',
      mainMinistryId: 'm1',
      trainingStatus: TrainingStatus.COMPLETED,
      servantMinistries: [{ ministryId: 'm1', trainingStatus: TrainingStatus.COMPLETED }],
    });
    prisma.pastoralVisit.count.mockResolvedValue(0);
    prisma.pastoralAlert.count.mockResolvedValue(0);
    prisma.ministryTaskTemplate.findUnique.mockResolvedValue({ maxAssignmentsPerServantPerMonth: 1 });
    prisma.ministryTaskOccurrence.count.mockResolvedValue(1);

    await expect(
      (service as any).assertServantEligible({
        templateId: 'tpl-1',
        ministryId: 'm1',
        serviceId: null,
        servantId: 'servant-1',
        scheduledFor: new Date('2026-04-20T19:00:00.000Z'),
        occurrenceId: null,
      }),
    ).rejects.toMatchObject({
      response: { code: 'MAX_ASSIGNMENTS_PER_MONTH_REACHED' },
    });
  });

  it('blocks assignment when service task conflict exists', async () => {
    const { service, prisma } = createService();
    prisma.servant.findFirst.mockResolvedValue({
      id: 'servant-1',
      mainMinistryId: 'm1',
      trainingStatus: TrainingStatus.COMPLETED,
      servantMinistries: [{ ministryId: 'm1', trainingStatus: TrainingStatus.COMPLETED }],
    });
    prisma.pastoralVisit.count.mockResolvedValue(0);
    prisma.pastoralAlert.count.mockResolvedValue(0);
    prisma.ministryTaskTemplate.findUnique.mockResolvedValue({ maxAssignmentsPerServantPerMonth: null });
    prisma.schedule.count.mockResolvedValue(0);
    prisma.ministryTaskOccurrence.count.mockResolvedValue(1);

    await expect(
      (service as any).assertServantEligible({
        templateId: 'tpl-1',
        ministryId: 'm1',
        serviceId: 'service-1',
        servantId: 'servant-1',
        scheduledFor: new Date('2026-04-20T19:00:00.000Z'),
        occurrenceId: 'occ-2',
      }),
    ).rejects.toMatchObject({
      response: { code: 'SERVICE_TIME_CONFLICT' },
    });
  });

  it('recalculates to completed when all required checklist items are done', async () => {
    const { service, prisma } = createService();
    prisma.ministryTaskOccurrence.findUnique = jest.fn().mockResolvedValue({
      id: 'occ-1',
      status: MinistryTaskOccurrenceStatus.IN_PROGRESS,
      assignedServantId: 'servant-1',
      scheduledFor: new Date('2026-04-20T19:00:00.000Z'),
      completedAt: null,
      completedBy: null,
      checklistItems: [
        { required: true, status: 'DONE' },
        { required: true, status: 'DONE' },
      ],
    });
    prisma.ministryTaskOccurrence.update = jest.fn().mockResolvedValue({ id: 'occ-1', status: 'COMPLETED' });

    await (service as any).recalculateStatus('occ-1', 'user-1');

    expect(prisma.ministryTaskOccurrence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', progressPercent: 100 }),
      }),
    );
  });

  it('reassigns occurrence preserving progress and registers history', async () => {
    const { service, prisma } = createService();
    prisma.ministryTaskOccurrence.findFirst = jest.fn().mockResolvedValue({
      id: 'occ-1',
      churchId: 'church-1',
      ministryId: 'm1',
      templateId: 'tpl-1',
      serviceId: 'svc-1',
      scheduledFor: new Date('2026-04-20T19:00:00.000Z'),
      assignedServantId: 'serv-old',
      checklistItems: [{ required: true, status: 'DONE' }],
    });
    prisma.ministryTaskOccurrence.update = jest.fn().mockResolvedValue({
      id: 'occ-1',
      churchId: 'church-1',
      assignedServantId: 'serv-new',
      checklistItems: [{ required: true, status: 'DONE' }],
    });
    prisma.ministryTaskOccurrenceAssignmentHistory = { create: jest.fn() };
    prisma.$transaction = jest.fn(async (cb) => cb(prisma));
    prisma.user.findFirst = jest.fn().mockResolvedValue(null);
    jest.spyOn(service as any, 'assertServantEligible').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'recalculateStatus').mockResolvedValue({
      id: 'occ-1',
      churchId: 'church-1',
      assignedServantId: 'serv-new',
      checklistItems: [{ required: true, status: 'DONE' }],
    });

    const result = await service.reassignOccurrence(
      'occ-1',
      { newAssignedServantId: 'serv-new', preserveProgress: true, reason: 'Troca operacional' },
      { sub: 'admin-1', role: 'ADMIN', churchId: 'church-1' } as any,
    );

    expect(prisma.ministryTaskOccurrenceAssignmentHistory.create).toHaveBeenCalled();
    expect(result.data.assignedServantId).toBe('serv-new');
  });

  it('auto reallocation balances tasks between remaining servants', async () => {
    const { service, prisma } = createService();
    prisma.worshipService.findFirst.mockResolvedValue({ id: 'svc-1', type: 'DOMINGO_MANHA' });
    prisma.ministryTaskOccurrence.findMany = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'occ-1',
          churchId: 'church-1',
          templateId: 'tpl-1',
          ministryId: 'm1',
          serviceId: 'svc-1',
          scheduledFor: new Date('2026-04-20T18:00:00.000Z'),
          assignedServantId: 'removed-1',
          status: 'ASSIGNED',
        },
        {
          id: 'occ-2',
          churchId: 'church-1',
          templateId: 'tpl-1',
          ministryId: 'm1',
          serviceId: 'svc-1',
          scheduledFor: new Date('2026-04-20T18:30:00.000Z'),
          assignedServantId: 'removed-1',
          status: 'ASSIGNED',
        },
      ])
      .mockResolvedValueOnce([
        { id: 'e1', ministryId: 'm1', assignedServantId: 'serv-a' },
        { id: 'e2', ministryId: 'm1', assignedServantId: 'serv-b' },
      ]);
    prisma.schedule.findMany = jest.fn().mockResolvedValue([
      { servantId: 'removed-1', ministryId: 'm1' },
      { servantId: 'serv-a', ministryId: 'm1' },
      { servantId: 'serv-b', ministryId: 'm1' },
    ]);
    jest.spyOn(service as any, 'assertServantEligible').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'applyAssignmentChange').mockResolvedValue({});

    const result = await service.reallocateFromRemovedServant(
      { serviceId: 'svc-1', removedServantId: 'removed-1', mode: 'AUTO_EQUAL_DISTRIBUTION' as any },
      { sub: 'admin-1', role: 'ADMIN', churchId: 'church-1' } as any,
    );

    expect(result.impacted).toBe(2);
    expect(result.reassigned).toBe(2);
    expect((service as any).applyAssignmentChange).toHaveBeenCalledTimes(2);
  });
});
