import { JourneyProjectionCheckpointStatus } from '@prisma/client';
import { JourneyCheckpointService } from './journey-checkpoint.service';

describe('JourneyCheckpointService', () => {
  const prisma = {
    journeyProjectionCheckpoint: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  } as any;

  let service: JourneyCheckpointService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new JourneyCheckpointService(prisma);
    prisma.journeyProjectionCheckpoint.count.mockResolvedValue(0);
  });

  it('creates checkpoint when it does not exist', async () => {
    prisma.journeyProjectionCheckpoint.findFirst.mockResolvedValue(null);
    prisma.journeyProjectionCheckpoint.create.mockResolvedValue({ id: 'cp-1' });

    await service.markProcessed({
      projectorName: 'journey_projector_v1',
      churchId: 'church-1',
      servantId: 'servant-1',
      eventKey: 'ATTENDANCE_REGISTERED:servant-1:attendance:att-1',
      status: JourneyProjectionCheckpointStatus.OK,
    });

    expect(prisma.journeyProjectionCheckpoint.create).toHaveBeenCalled();
  });

  it('updates checkpoint when it already exists', async () => {
    prisma.journeyProjectionCheckpoint.findFirst.mockResolvedValue({ id: 'cp-1' });
    prisma.journeyProjectionCheckpoint.update.mockResolvedValue({ id: 'cp-1' });

    await service.markReconciled({
      projectorName: 'journey_projector_v1',
      churchId: 'church-1',
      servantId: 'servant-1',
      status: JourneyProjectionCheckpointStatus.WARNING,
    });

    expect(prisma.journeyProjectionCheckpoint.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cp-1' } }),
    );
  });
});

