import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from 'src/modules/auth/types/jwt-payload.type';

@Injectable()
export class TenantIntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  getActorChurchId(actor: JwtPayload): string | null {
    return actor.churchId ?? null;
  }

  assertActorChurch(actor: JwtPayload): string {
    if (actor.role === Role.SUPER_ADMIN && !actor.churchId) {
      throw new ForbiddenException(
        'SUPER_ADMIN must select a church context (x-church-id) for tenant-scoped operations',
      );
    }

    if (!actor.churchId) {
      throw new ForbiddenException('Authenticated user has no church context');
    }

    return actor.churchId;
  }

  assertSameChurch(actorChurchId: string, entityChurchId: string | null | undefined, entityName: string) {
    if (!entityChurchId) {
      throw new ForbiddenException(`${entityName} has no church scope`);
    }

    if (entityChurchId !== actorChurchId) {
      throw new ForbiddenException(`${entityName} belongs to another church`);
    }
  }

  async assertServantChurch(servantId: string, actor: JwtPayload) {
    const actorChurchId = this.assertActorChurch(actor);
    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: { id: true, churchId: true },
    });
    if (!servant) {
      throw new NotFoundException('Servant not found');
    }
    this.assertSameChurch(actorChurchId, servant.churchId, 'Servant');
    return servant;
  }

  async assertMinistryChurch(ministryId: string, actor: JwtPayload) {
    const actorChurchId = this.assertActorChurch(actor);
    const ministry = await this.prisma.ministry.findUnique({
      where: { id: ministryId },
      select: { id: true, churchId: true },
    });
    if (!ministry) {
      throw new NotFoundException('Ministry not found');
    }
    this.assertSameChurch(actorChurchId, ministry.churchId, 'Ministry');
    return ministry;
  }

  async assertTeamChurch(teamId: string, actor: JwtPayload) {
    const actorChurchId = this.assertActorChurch(actor);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, churchId: true, ministryId: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    this.assertSameChurch(actorChurchId, team.churchId, 'Team');
    return team;
  }

  async assertWorshipServiceChurch(serviceId: string, actor: JwtPayload) {
    const actorChurchId = this.assertActorChurch(actor);
    const service = await this.prisma.worshipService.findUnique({
      where: { id: serviceId },
      select: { id: true, churchId: true },
    });
    if (!service) {
      throw new NotFoundException('Worship service not found');
    }
    this.assertSameChurch(actorChurchId, service.churchId, 'Worship service');
    return service;
  }

  async assertPastoralVisitChurch(visitId: string, actor: JwtPayload) {
    const actorChurchId = this.assertActorChurch(actor);
    const visit = await this.prisma.pastoralVisit.findUnique({
      where: { id: visitId },
      select: { id: true, churchId: true, servantId: true },
    });
    if (!visit) {
      throw new NotFoundException('Pastoral visit not found');
    }
    this.assertSameChurch(actorChurchId, visit.churchId, 'Pastoral visit');
    return visit;
  }

  assertLinkIntegrity(
    actor: JwtPayload,
    entities: Array<{ churchId: string | null | undefined; name: string }>,
  ) {
    const actorChurchId = this.assertActorChurch(actor);
    for (const entity of entities) {
      this.assertSameChurch(actorChurchId, entity.churchId, entity.name);
    }
  }
}
