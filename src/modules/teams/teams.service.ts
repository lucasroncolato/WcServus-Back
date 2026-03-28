import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, Role, TeamStatus } from '@prisma/client';
import { assertTeamAccess, getTeamAccessWhere, assertMinistryAccess } from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { UpdateTeamLeaderDto } from './dto/update-team-leader.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: ListTeamsQueryDto, actor: JwtPayload) {
    const scopeWhere = await getTeamAccessWhere(this.prisma, actor);
    const search = query.search?.trim();

    const queryWhere: Prisma.TeamWhereInput = {
      ministryId: query.ministryId,
      status: query.status,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const where = scopeWhere ? { AND: [queryWhere, scopeWhere] } : queryWhere;

    const records = await this.prisma.team.findMany({
      where,
      include: {
        ministry: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true } },
        _count: { select: { servants: true } },
      },
      orderBy: [{ ministry: { name: 'asc' } }, { name: 'asc' }],
    });

    return {
      data: records.map((record) => this.serializeTeam(record)),
    };
  }

  async findOne(id: string, actor: JwtPayload) {
    await assertTeamAccess(this.prisma, actor, id);

    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        ministry: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { servants: true } },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return { data: this.serializeTeam(team) };
  }

  async create(dto: CreateTeamDto, actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN && actor.role !== Role.COORDENADOR) {
      throw new ForbiddenException('You do not have permission to create teams');
    }

    if (actor.role === Role.COORDENADOR) {
      await assertMinistryAccess(this.prisma, actor, dto.ministryId);
    }

    await this.ensureMinistryExists(dto.ministryId);

    const existing = await this.prisma.team.findFirst({
      where: { ministryId: dto.ministryId, name: dto.name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A team with this name already exists in this ministry');
    }

    const created = await this.prisma.team.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        ministryId: dto.ministryId,
        status: dto.status ?? TeamStatus.ACTIVE,
      },
      include: {
        ministry: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entity: 'Team',
      entityId: created.id,
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return { data: this.serializeTeam(created) };
  }

  async update(id: string, dto: UpdateTeamDto, actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN && actor.role !== Role.COORDENADOR) {
      throw new ForbiddenException('You do not have permission to update teams');
    }

    const current = await this.prisma.team.findUnique({
      where: { id },
      select: { id: true, name: true, ministryId: true, status: true },
    });

    if (!current) {
      throw new NotFoundException('Team not found');
    }

    if (actor.role === Role.COORDENADOR) {
      await assertMinistryAccess(this.prisma, actor, current.ministryId);
    }

    if (dto.name && dto.name !== current.name) {
      const duplicated = await this.prisma.team.findFirst({
        where: { id: { not: id }, ministryId: current.ministryId, name: dto.name },
        select: { id: true },
      });
      if (duplicated) {
        throw new ConflictException('A team with this name already exists in this ministry');
      }
    }

    const updated = await this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        status: dto.status,
      },
      include: {
        ministry: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'Team',
      entityId: id,
      userId: actor.sub,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return { data: this.serializeTeam(updated) };
  }

  async remove(id: string, actor: JwtPayload) {
    if (actor.role !== Role.SUPER_ADMIN && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN and ADMIN can inactivate teams');
    }

    await this.ensureTeamExists(id);

    const updated = await this.prisma.team.update({
      where: { id },
      data: { status: TeamStatus.INACTIVE },
      include: {
        ministry: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.STATUS_CHANGE,
      entity: 'Team',
      entityId: id,
      userId: actor.sub,
      metadata: { status: TeamStatus.INACTIVE },
    });

    return { message: 'Team inactivated successfully', data: this.serializeTeam(updated) };
  }

  async members(id: string, actor: JwtPayload) {
    await assertTeamAccess(this.prisma, actor, id);
    await this.ensureTeamExists(id);

    const servants = await this.prisma.servant.findMany({
      where: { teamId: id },
      include: {
        mainMinistry: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: servants,
    };
  }

  async addMember(teamId: string, servantId: string, actor: JwtPayload) {
    await this.assertCanManageMembers(actor, teamId);

    const [team, servant] = await Promise.all([
      this.prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, ministryId: true, status: true },
      }),
      this.prisma.servant.findUnique({
        where: { id: servantId },
        select: { id: true, mainMinistryId: true, servantMinistries: { select: { ministryId: true } } },
      }),
    ]);

    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (!servant) {
      throw new NotFoundException('Servant not found');
    }
    if (team.status !== TeamStatus.ACTIVE) {
      throw new BadRequestException('Cannot add member to an inactive team');
    }

    const servantMinistryIds = new Set([
      ...(servant.mainMinistryId ? [servant.mainMinistryId] : []),
      ...servant.servantMinistries.map((item) => item.ministryId),
    ]);

    if (!servantMinistryIds.has(team.ministryId)) {
      throw new BadRequestException('Servant does not belong to the team ministry');
    }

    const updated = await this.prisma.servant.update({
      where: { id: servantId },
      data: { teamId },
      include: {
        mainMinistry: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, ministryId: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'TeamMember',
      entityId: `${teamId}:${servantId}`,
      userId: actor.sub,
      metadata: { teamId, servantId, action: 'ADD' },
    });

    return { data: updated };
  }

  async removeMember(teamId: string, servantId: string, actor: JwtPayload) {
    await this.assertCanManageMembers(actor, teamId);

    const servant = await this.prisma.servant.findUnique({
      where: { id: servantId },
      select: { id: true, teamId: true },
    });
    if (!servant) {
      throw new NotFoundException('Servant not found');
    }
    if (servant.teamId !== teamId) {
      throw new BadRequestException('Servant is not a member of this team');
    }

    const updated = await this.prisma.servant.update({
      where: { id: servantId },
      data: { teamId: null },
      include: {
        mainMinistry: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'TeamMember',
      entityId: `${teamId}:${servantId}`,
      userId: actor.sub,
      metadata: { teamId, servantId, action: 'REMOVE' },
    });

    return { data: updated };
  }

  async updateLeader(teamId: string, dto: UpdateTeamLeaderDto, actor: JwtPayload) {
    await this.assertCanManageMembers(actor, teamId);
    await this.ensureTeamExists(teamId);

    if (dto.leaderUserId === null) {
      const updated = await this.prisma.team.update({
        where: { id: teamId },
        data: { leaderUserId: null },
        include: {
          ministry: { select: { id: true, name: true } },
          leader: { select: { id: true, name: true, email: true } },
        },
      });

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: 'TeamLeader',
        entityId: teamId,
        userId: actor.sub,
        metadata: { leaderUserId: null },
      });

      return { data: updated };
    }

    if (!dto.leaderUserId) {
      throw new BadRequestException('leaderUserId is required');
    }

    const leaderUser = await this.prisma.user.findUnique({
      where: { id: dto.leaderUserId },
      select: { id: true, role: true, status: true, servantId: true },
    });

    if (!leaderUser) {
      throw new NotFoundException('Leader user not found');
    }

    if (leaderUser.role !== Role.COORDENADOR) {
      throw new BadRequestException('Selected user must have role COORDENADOR');
    }

    const currentLed = await this.prisma.team.findFirst({
      where: { leaderUserId: dto.leaderUserId, id: { not: teamId }, status: TeamStatus.ACTIVE },
      select: { id: true },
    });

    if (currentLed) {
      throw new ConflictException('This leader already leads another active team');
    }

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data: { leaderUserId: dto.leaderUserId },
      include: {
        ministry: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entity: 'TeamLeader',
      entityId: teamId,
      userId: actor.sub,
      metadata: { leaderUserId: dto.leaderUserId },
    });

    return { data: this.serializeTeam(updated) };
  }

  private async assertCanManageMembers(actor: JwtPayload, teamId: string) {
    if (actor.role === Role.SUPER_ADMIN || actor.role === Role.ADMIN) {
      return;
    }

    if (actor.role !== Role.COORDENADOR) {
      throw new ForbiddenException('You do not have permission to manage team members');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, ministryId: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await assertMinistryAccess(this.prisma, actor, team.ministryId);
  }

  private async ensureTeamExists(id: string) {
    const found = await this.prisma.team.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException('Team not found');
    }
  }

  private async ensureMinistryExists(id: string) {
    const found = await this.prisma.ministry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException('Ministry not found');
    }
  }

  private serializeTeam<T extends { ministryId: string; ministry?: { id: string; name: string } | null }>(team: T) {
    return {
      ...team,
      ministryId: team.ministryId,
      ministry: team.ministry ? { id: team.ministry.id, name: team.ministry.name } : null,
    };
  }
}



