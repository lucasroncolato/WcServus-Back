import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { JourneyController } from './journey.controller';

describe('JourneyController', () => {
  const journeyService = {
    getMyJourney: jest.fn().mockResolvedValue({}),
    getSummary: jest.fn().mockResolvedValue({}),
    getMilestones: jest.fn().mockResolvedValue([]),
    getLogs: jest.fn().mockResolvedValue([]),
    getIndicators: jest.fn().mockResolvedValue([]),
    getNextSteps: jest.fn().mockResolvedValue([]),
    dismissNextStep: jest.fn().mockResolvedValue({ success: true }),
  } as any;

  const controller = new JourneyController(journeyService);

  const servoUser: JwtPayload = {
    sub: 'u-servo',
    email: 'servo@test.com',
    role: Role.SERVO,
    servantId: 'servant-1',
    churchId: 'church-1',
  };

  it('allows only authenticated SERVO and resolves servant from token', async () => {
    await controller.me(servoUser);

    expect(journeyService.getMyJourney).toHaveBeenCalledWith('servant-1', 'church-1');
  });

  it('returns 403 for non-servo profile', async () => {
    const adminUser: JwtPayload = {
      ...servoUser,
      role: Role.ADMIN,
    };

    await expect(controller.me(adminUser)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 403 when servo has no linked servantId', async () => {
    const orphanServo: JwtPayload = {
      ...servoUser,
      servantId: null,
    };

    await expect(controller.summary(orphanServo)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('routes next steps endpoints using authenticated servant', async () => {
    await controller.nextSteps(servoUser);
    await controller.dismissNextStep(servoUser, 'step-1', {});

    expect(journeyService.getNextSteps).toHaveBeenCalledWith('servant-1', 'church-1');
    expect(journeyService.dismissNextStep).toHaveBeenCalledWith('servant-1', 'church-1', 'step-1');
  });
});
