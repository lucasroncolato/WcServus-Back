import { Injectable } from '@nestjs/common';
import {
  getEligibilityImpact,
} from 'src/common/attendance/attendance-status.utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { EligibilityContext } from './eligibility.types';

@Injectable()
export class EligibilityScoreService {
  constructor(private readonly prisma: PrismaService) {}

  async score(context: EligibilityContext): Promise<{ score: number; priority: 'LOW' | 'MEDIUM' | 'HIGH' }> {
    const servantId = context.servant.id;

    const [lastSchedule, attendanceAgg, activeSchedules] = await Promise.all([
      this.prisma.schedule.findFirst({
        where: { servantId },
        orderBy: [{ service: { serviceDate: 'desc' } }],
        include: { service: { select: { serviceDate: true } } },
      }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { servantId },
        _count: { status: true },
      }),
      this.prisma.schedule.count({
        where: {
          servantId,
          responseStatus: { in: ['PENDING', 'CONFIRMED'] },
        },
      }),
    ]);

    const attendanceImpact = attendanceAgg.reduce(
      (acc, item) => acc + getEligibilityImpact(item.status) * item._count.status,
      0,
    );

    const daysSinceLastScale = lastSchedule?.service?.serviceDate
      ? Math.max(
          0,
          Math.round((Date.now() - new Date(lastSchedule.service.serviceDate).getTime()) / (1000 * 60 * 60 * 24)),
        )
      : 60;

    let total = 0;
    total += Math.min(30, daysSinceLastScale * 0.8);
    total += Math.max(0, Math.min(40, 20 + attendanceImpact * 3));
    total += context.slot?.requiredTraining === false || context.servant.trainingStatus === 'COMPLETED' ? 10 : 0;
    total += context.unavailableAtServiceTime ? 0 : 10;
    total += !context.requiredAptitude || context.requiredAptitude === context.servant.aptitude ? 10 : 0;
    total += Math.max(0, 10 - activeSchedules * 2);
    total += context.hasPastoralPending ? -20 : 0;

    const score = Math.max(0, Math.min(100, Math.round(total)));
    const priority: 'LOW' | 'MEDIUM' | 'HIGH' = score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';

    return { score, priority };
  }
}
