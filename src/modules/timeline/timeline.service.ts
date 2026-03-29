import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TimelineScope } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { TimelineQueryDto } from './dto/timeline-query.dto';

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async church(actor: JwtPayload, query: TimelineQueryDto) {
    const churchId = this.requireChurch(actor);
    const where = this.makeWhere(query, { churchId, scope: TimelineScope.CHURCH });
    return this.prisma.timelineEntry.findMany({ where, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  async ministry(actor: JwtPayload, ministryId: string, query: TimelineQueryDto) {
    const churchId = this.requireChurch(actor);
    const ministry = await this.prisma.ministry.findFirst({ where: { id: ministryId, churchId, deletedAt: null } });
    if (!ministry) throw new NotFoundException('Ministry not found');
    const where = this.makeWhere(query, { churchId, ministryId });
    return this.prisma.timelineEntry.findMany({ where, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  async servant(actor: JwtPayload, servantId: string, query: TimelineQueryDto) {
    const churchId = this.requireChurch(actor);
    const servant = await this.prisma.servant.findFirst({ where: { id: servantId, churchId, deletedAt: null } });
    if (!servant) throw new NotFoundException('Servant not found');
    const where = this.makeWhere(query, { churchId, servantId });
    return this.prisma.timelineEntry.findMany({ where, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  async me(actor: JwtPayload, query: TimelineQueryDto) {
    if (!actor.servantId || !actor.churchId) {
      throw new ForbiddenException('User has no servant scope');
    }
    const where = this.makeWhere(query, { churchId: actor.churchId, servantId: actor.servantId });
    return this.prisma.timelineEntry.findMany({ where, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  private requireChurch(actor: JwtPayload) {
    if (!actor.churchId) {
      throw new ForbiddenException('Actor must be bound to a church context');
    }
    return actor.churchId;
  }

  private makeWhere(
    query: TimelineQueryDto,
    base: { churchId: string; ministryId?: string; servantId?: string; scope?: TimelineScope },
  ) {
    return {
      churchId: base.churchId,
      ...(base.ministryId ? { ministryId: base.ministryId } : {}),
      ...(base.servantId ? { servantId: base.servantId } : {}),
      ...(base.scope ? { scope: base.scope } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.origin ? { metadata: { path: ['origin'], equals: query.origin } } : {}),
      occurredAt:
        query.startDate || query.endDate
          ? {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            }
          : undefined,
    };
  }
}
