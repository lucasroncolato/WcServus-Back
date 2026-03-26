import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Role, SupportRequestStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { ListSupportRequestsQueryDto } from './dto/list-support-requests-query.dto';
import { UpdateSupportRequestStatusDto } from './dto/update-support-request-status.dto';

@Injectable()
export class SupportRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateSupportRequestDto, actor: JwtPayload) {
    if (actor.role !== Role.PASTOR && actor.role !== Role.COORDENADOR) {
      throw new ForbiddenException('Only PASTOR and COORDENADOR can open support requests');
    }

    const request = await this.prisma.supportRequest.create({
      data: {
        type: dto.type,
        subject: dto.subject,
        description: dto.description,
        reference: dto.reference,
        authorUserId: actor.sub,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        handledBy: { select: { id: true, name: true, role: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'SupportRequest',
      entityId: request.id,
      userId: actor.sub,
      metadata: { type: request.type, subject: request.subject },
    });

    return request;
  }

  async findAll(query: ListSupportRequestsQueryDto, actor: JwtPayload) {
    const where = {
      status: query.status,
      type: query.type,
      ...(actor.role === Role.PASTOR || actor.role === Role.COORDENADOR
        ? { authorUserId: actor.sub }
        : {}),
    };

    return this.prisma.supportRequest.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, role: true } },
        handledBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async updateStatus(id: string, dto: UpdateSupportRequestStatusDto, actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN and ADMIN can update support requests');
    }

    const current = await this.prisma.supportRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!current) {
      throw new NotFoundException('Support request not found');
    }

    const updated = await this.prisma.supportRequest.update({
      where: { id },
      data: {
        status: dto.status,
        handledByUserId: actor.sub,
        handledAt:
          dto.status === SupportRequestStatus.RESOLVIDO || dto.status === SupportRequestStatus.EM_ANALISE
            ? new Date()
            : null,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        handledBy: { select: { id: true, name: true, role: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: 'SupportRequest',
      entityId: id,
      userId: actor.sub,
      metadata: {
        fromStatus: current.status,
        toStatus: dto.status,
        notes: dto.notes,
      },
    });

    return updated;
  }
}
