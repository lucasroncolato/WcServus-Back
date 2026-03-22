import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWorshipServiceDto } from './dto/create-worship-service.dto';
import { ListWorshipServicesQueryDto } from './dto/list-worship-services-query.dto';
import { UpdateWorshipServiceDto } from './dto/update-worship-service.dto';

@Injectable()
export class WorshipServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(query: ListWorshipServicesQueryDto) {
    return this.prisma.worshipService.findMany({
      where: {
        serviceDate:
          query.startDate || query.endDate
            ? {
                gte: query.startDate ? new Date(query.startDate) : undefined,
                lte: query.endDate ? new Date(query.endDate) : undefined,
              }
            : undefined,
      },
      orderBy: { serviceDate: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.worshipService.findUniqueOrThrow({
      where: { id },
      include: {
        schedules: true,
        attendances: true,
      },
    });
  }

  async create(dto: CreateWorshipServiceDto, actorUserId?: string) {
    const service = await this.prisma.worshipService.create({
      data: {
        ...dto,
        serviceDate: new Date(dto.serviceDate),
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'WorshipService',
      entityId: service.id,
      userId: actorUserId,
    });

    return service;
  }

  async update(id: string, dto: UpdateWorshipServiceDto, actorUserId?: string) {
    await this.ensureExists(id);

    const service = await this.prisma.worshipService.update({
      where: { id },
      data: {
        ...dto,
        serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : undefined,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'WorshipService',
      entityId: id,
      userId: actorUserId,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return service;
  }

  private async ensureExists(id: string) {
    const found = await this.prisma.worshipService.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException('Worship service not found');
    }
  }
}