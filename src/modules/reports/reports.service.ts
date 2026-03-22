import { Injectable } from '@nestjs/common';
import { AttendanceStatus, PastoralVisitStatus, Prisma } from '@prisma/client';
import { getServantAccessWhere } from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PeriodQueryDto } from './dto/period-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async attendanceReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);

    const services = await this.prisma.worshipService.findMany({
      where: {
        serviceDate: period,
      },
      include: {
        attendances: {
          where: servantWhere ? { servant: servantWhere } : undefined,
          include: {
            servant: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { serviceDate: 'asc' },
    });

    return services.map((service) => {
      const presentes = service.attendances.filter((a) => a.status === AttendanceStatus.PRESENTE).length;
      const faltas = service.attendances.filter((a) => a.status !== AttendanceStatus.PRESENTE).length;

      return {
        serviceId: service.id,
        title: service.title,
        date: service.serviceDate,
        totalRegistros: service.attendances.length,
        presentes,
        faltas,
        assiduidade: service.attendances.length === 0 ? 0 : Number(((presentes / service.attendances.length) * 100).toFixed(2)),
      };
    });
  }

  async absencesReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);

    const absences = await this.prisma.attendance.findMany({
      where: {
        status: { in: [AttendanceStatus.FALTA, AttendanceStatus.FALTA_JUSTIFICADA] },
        service: { serviceDate: period },
        servant: servantWhere ?? undefined,
      },
      include: {
        servant: {
          include: { mainSector: true },
        },
      },
    });

    const byServant = new Map<string, { servantId: string; name: string; sector: string | null; faltas: number }>();
    const bySector = new Map<string, { sectorId: string | null; sector: string; faltas: number }>();

    for (const attendance of absences) {
      const servantKey = attendance.servantId;
      const sectorName = attendance.servant.mainSector?.name ?? 'Sem setor';
      const sectorId = attendance.servant.mainSector?.id ?? null;

      const servantCounter =
        byServant.get(servantKey) ??
        {
          servantId: attendance.servantId,
          name: attendance.servant.name,
          sector: sectorName,
          faltas: 0,
        };
      servantCounter.faltas += 1;
      byServant.set(servantKey, servantCounter);

      const sectorCounter =
        bySector.get(sectorName) ??
        {
          sectorId,
          sector: sectorName,
          faltas: 0,
        };
      sectorCounter.faltas += 1;
      bySector.set(sectorName, sectorCounter);
    }

    return {
      totalFaltas: absences.length,
      porServo: [...byServant.values()].sort((a, b) => b.faltas - a.faltas),
      porSetor: [...bySector.values()].sort((a, b) => b.faltas - a.faltas),
    };
  }

  async pastoralVisitsReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);

    const visits = await this.prisma.pastoralVisit.findMany({
      where: {
        openedAt: period,
        servant: servantWhere ?? undefined,
      },
      include: {
        servant: true,
        createdBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    return {
      total: visits.length,
      abertas: visits.filter((v) => v.status === PastoralVisitStatus.ABERTA).length,
      emAndamento: visits.filter((v) => v.status === PastoralVisitStatus.EM_ANDAMENTO).length,
      resolvidas: visits.filter((v) => v.status === PastoralVisitStatus.RESOLVIDA).length,
      registros: visits,
    };
  }

  async talentsReport(query: PeriodQueryDto, actor: JwtPayload) {
    const period = this.resolvePeriod(query);
    const servantWhere = await this.getScopedServantFilter(actor);

    const talents = await this.prisma.talent.findMany({
      where: {
        createdAt: period,
        servant: servantWhere ?? undefined,
      },
      include: { servant: true },
      orderBy: { createdAt: 'desc' },
    });

    const byStage = talents.reduce<Record<string, number>>((acc, talent) => {
      acc[talent.stage] = (acc[talent.stage] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: talents.length,
      porEtapa: byStage,
      aprovados: talents.filter((t) => t.stage === 'APROVADO').length,
      registros: talents,
    };
  }

  private resolvePeriod(query: PeriodQueryDto) {
    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

    return {
      gte: query.startDate ? new Date(query.startDate) : defaultStart,
      lte: query.endDate ? new Date(query.endDate) : defaultEnd,
    };
  }

  private async getScopedServantFilter(actor: JwtPayload): Promise<Prisma.ServantWhereInput | undefined> {
    return getServantAccessWhere(this.prisma, actor);
  }
}
