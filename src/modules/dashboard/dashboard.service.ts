import { Injectable } from '@nestjs/common';
import { AlertStatus, AttendanceStatus, PastoralVisitStatus, ServantStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

    const [
      totalServosAtivos,
      faltasDoMes,
      visitasPendentes,
      totalAttendances,
      presentes,
      resumoSetor,
      alertasPastorais,
    ] = await Promise.all([
      this.prisma.servant.count({ where: { status: ServantStatus.ATIVO } }),
      this.prisma.attendance.count({
        where: {
          status: { in: [AttendanceStatus.FALTA, AttendanceStatus.FALTA_JUSTIFICADA] },
          service: {
            serviceDate: { gte: monthStart, lte: monthEnd },
          },
        },
      }),
      this.prisma.pastoralVisit.count({
        where: {
          status: { in: [PastoralVisitStatus.ABERTA, PastoralVisitStatus.EM_ANDAMENTO] },
        },
      }),
      this.prisma.attendance.count({
        where: {
          service: {
            serviceDate: { gte: monthStart, lte: monthEnd },
          },
        },
      }),
      this.prisma.attendance.count({
        where: {
          status: AttendanceStatus.PRESENTE,
          service: {
            serviceDate: { gte: monthStart, lte: monthEnd },
          },
        },
      }),
      this.prisma.sector.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: { servants: true, schedules: true },
          },
        },
      }),
      this.prisma.pastoralAlert.findMany({
        where: { status: AlertStatus.OPEN },
        include: { servant: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const assiduidadeGeral = totalAttendances === 0 ? 0 : (presentes / totalAttendances) * 100;

    return {
      totalServosAtivos,
      faltasDoMes,
      visitasPastoraisPendentes: visitasPendentes,
      assiduidadeGeral: Number(assiduidadeGeral.toFixed(2)),
      resumoPorSetor: resumoSetor.map((item) => ({
        id: item.id,
        name: item.name,
        servants: item._count.servants,
        schedules: item._count.schedules,
      })),
      alertasPastorais: alertasPastorais.map((alerta) => ({
        id: alerta.id,
        trigger: alerta.trigger,
        message: alerta.message,
        servant: { id: alerta.servant.id, name: alerta.servant.name },
        createdAt: alerta.createdAt,
      })),
    };
  }

  alerts() {
    return this.prisma.pastoralAlert.findMany({
      where: { status: AlertStatus.OPEN },
      include: {
        servant: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}